"""TikTok adapter using the Content Posting API (direct video upload)."""

from __future__ import annotations

import math
import time

from ..content_generator import PostContent
from .base import Platform, PublishResult
from .media import media_kind, resolve_media_path

_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"
_CHUNK_SIZE = 10 * 1024 * 1024
_POLL_INTERVAL_SECONDS = 3
_POLL_TIMEOUT_SECONDS = 180
_SUCCESS_STATUSES = {"PUBLISH_COMPLETE", "PUBLISHED", "SUCCESS"}
_FAILURE_STATUSES = {"FAILED", "FAIL"}


class TikTokPlatform(Platform):
    name = "tiktok"

    def is_configured(self) -> bool:
        return bool(self._settings.tiktok_access_token)

    def _poll_publish_status(self, requests, publish_id: str, headers: dict) -> PublishResult:
        deadline = time.time() + _POLL_TIMEOUT_SECONDS
        while time.time() < deadline:
            status_response = requests.post(
                _STATUS_URL,
                json={"publish_id": publish_id},
                headers=headers,
                timeout=30,
            )
            if status_response.status_code != 200:
                return PublishResult(
                    success=False,
                    error=f"TikTok status check failed: HTTP {status_response.status_code}: {status_response.text}",
                )

            status_data = status_response.json().get("data", {})
            status = str(status_data.get("status", "")).upper()
            if status in _SUCCESS_STATUSES:
                return PublishResult(success=True, external_id=str(status_data.get("publish_id", publish_id)))
            if status in _FAILURE_STATUSES:
                return PublishResult(success=False, error=f"TikTok publish failed: {status_data}")

            time.sleep(_POLL_INTERVAL_SECONDS)

        return PublishResult(
            success=False,
            error=f"TikTok publish timed out after {_POLL_TIMEOUT_SECONDS}s (publish_id={publish_id}).",
        )

    def publish(self, content: PostContent) -> PublishResult:
        if self._settings.dry_run:
            media_path, media_error = resolve_media_path(content.media_path)
            if media_error:
                return PublishResult(success=False, error=media_error)
            if media_path is None:
                return PublishResult(success=False, error="TikTok requires a video file. Pass --media /path/to/video.mp4")
            return PublishResult(success=True, external_id="dry-run")

        if not self.is_configured():
            return PublishResult(success=False, error="TikTok credentials are not configured (TIKTOK_ACCESS_TOKEN).")

        media_path, media_error = resolve_media_path(content.media_path)
        if media_error:
            return PublishResult(success=False, error=media_error)
        if media_path is None:
            return PublishResult(success=False, error="TikTok requires a video file. Pass --media /path/to/video.mp4")

        if media_kind(media_path) != "video":
            return PublishResult(success=False, error=f"TikTok only supports video uploads. Got: {media_path.suffix}")

        try:
            import requests
        except ImportError:
            return PublishResult(
                success=False,
                error="The 'requests' package is required. Install with `pip install requests`.",
            )

        video_size = media_path.stat().st_size
        chunk_size = min(_CHUNK_SIZE, video_size) or video_size
        total_chunks = max(1, math.ceil(video_size / chunk_size))
        headers = {
            "Authorization": f"Bearer {self._settings.tiktok_access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        }
        body = {
            "post_info": {
                "title": content.full_text[:2200],
                "privacy_level": self._settings.tiktok_privacy_level,
                "disable_duet": False,
                "disable_comment": False,
                "disable_stitch": False,
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": chunk_size,
                "total_chunk_count": total_chunks,
            },
        }

        try:
            init_response = requests.post(_INIT_URL, json=body, headers=headers, timeout=30)
            if init_response.status_code != 200:
                return PublishResult(
                    success=False,
                    error=f"TikTok upload init failed: HTTP {init_response.status_code}: {init_response.text}",
                )

            payload = init_response.json()
            error_info = payload.get("error", {})
            if error_info.get("code") not in ("ok", 0, None) and error_info:
                return PublishResult(success=False, error=f"TikTok API error: {error_info}")

            data = payload.get("data", {})
            upload_url = data.get("upload_url")
            publish_id = data.get("publish_id")
            if not upload_url or not publish_id:
                return PublishResult(success=False, error=f"TikTok init response missing upload_url/publish_id: {payload}")

            with media_path.open("rb") as video_file:
                for chunk_index in range(total_chunks):
                    start = chunk_index * chunk_size
                    chunk = video_file.read(chunk_size)
                    end = start + len(chunk) - 1
                    upload_response = requests.put(
                        upload_url,
                        data=chunk,
                        headers={
                            "Content-Type": "video/mp4",
                            "Content-Length": str(len(chunk)),
                            "Content-Range": f"bytes {start}-{end}/{video_size}",
                        },
                        timeout=600,
                    )
                    if upload_response.status_code not in (200, 201, 204):
                        return PublishResult(
                            success=False,
                            error=(
                                f"TikTok chunk {chunk_index + 1}/{total_chunks} upload failed: "
                                f"HTTP {upload_response.status_code}: {upload_response.text}"
                            ),
                        )

            return self._poll_publish_status(requests, publish_id, headers)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(success=False, error=str(exc))
