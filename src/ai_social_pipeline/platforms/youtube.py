"""YouTube adapter using the Data API v3 resumable upload flow (requests only)."""

from __future__ import annotations

from ..content_generator import PostContent
from .base import Platform, PublishResult
from .media import media_kind, resolve_media_path

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_UPLOAD_INIT_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status"


class YouTubePlatform(Platform):
    name = "youtube"

    def is_configured(self) -> bool:
        s = self._settings
        return bool(s.youtube_client_id and s.youtube_client_secret and s.youtube_refresh_token)

    def _access_token(self) -> tuple[str | None, str | None]:
        try:
            import requests
        except ImportError:
            return None, "The 'requests' package is required. Install with `pip install requests`."

        try:
            response = requests.post(
                _TOKEN_URL,
                data={
                    "client_id": self._settings.youtube_client_id,
                    "client_secret": self._settings.youtube_client_secret,
                    "refresh_token": self._settings.youtube_refresh_token,
                    "grant_type": "refresh_token",
                },
                timeout=15,
            )
            if response.status_code != 200:
                return None, f"Failed to refresh YouTube token: HTTP {response.status_code}: {response.text}"
            token = response.json().get("access_token")
            if not token:
                return None, "YouTube token response did not include access_token."
            return token, None
        except Exception as exc:  # noqa: BLE001
            return None, str(exc)

    def publish(self, content: PostContent) -> PublishResult:
        if self._settings.dry_run:
            return PublishResult(success=True, external_id="dry-run")

        if not self.is_configured():
            return PublishResult(success=False, error="YouTube credentials are not configured.")

        media_path, media_error = resolve_media_path(content.media_path)
        if media_error:
            return PublishResult(success=False, error=media_error)
        if media_path is None:
            return PublishResult(success=False, error="YouTube requires a video file. Pass --media /path/to/video.mp4")

        if media_kind(media_path) != "video":
            return PublishResult(success=False, error=f"YouTube only supports video uploads. Got: {media_path.suffix}")

        token, token_error = self._access_token()
        if token_error:
            return PublishResult(success=False, error=token_error)

        try:
            import requests
        except ImportError:
            return PublishResult(
                success=False,
                error="The 'requests' package is required. Install with `pip install requests`.",
            )

        title = content.title or content.topic
        metadata = {
            "snippet": {
                "title": title,
                "description": content.full_text,
                "categoryId": self._settings.youtube_category_id,
            },
            "status": {
                "privacyStatus": self._settings.youtube_privacy_status,
                "selfDeclaredMadeForKids": False,
            },
        }
        video_size = media_path.stat().st_size
        init_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": "video/*",
            "X-Upload-Content-Length": str(video_size),
        }

        try:
            init_response = requests.post(_UPLOAD_INIT_URL, json=metadata, headers=init_headers, timeout=30)
            if init_response.status_code not in (200, 201):
                return PublishResult(
                    success=False,
                    error=f"YouTube upload init failed: HTTP {init_response.status_code}: {init_response.text}",
                )

            upload_url = init_response.headers.get("Location")
            if not upload_url:
                return PublishResult(success=False, error="YouTube upload init did not return an upload URL.")

            with media_path.open("rb") as video_file:
                upload_response = requests.put(
                    upload_url,
                    data=video_file,
                    headers={"Content-Type": "video/*"},
                    timeout=600,
                )

            if upload_response.status_code not in (200, 201):
                return PublishResult(
                    success=False,
                    error=f"YouTube upload failed: HTTP {upload_response.status_code}: {upload_response.text}",
                )

            video_id = upload_response.json().get("id")
            return PublishResult(success=True, external_id=video_id)
        except Exception as exc:  # noqa: BLE001
            return PublishResult(success=False, error=str(exc))
