"""LinkedIn adapter using the UGC Posts REST API."""

from __future__ import annotations

from ..content_generator import PostContent
from .base import Platform, PublishResult

_UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts"


class LinkedInPlatform(Platform):
    name = "linkedin"

    def is_configured(self) -> bool:
        s = self._settings
        return bool(s.linkedin_access_token and s.linkedin_author_urn)

    def publish(self, content: PostContent) -> PublishResult:
        if self._settings.dry_run:
            return PublishResult(success=True, external_id="dry-run")

        if not self.is_configured():
            return PublishResult(success=False, error="LinkedIn credentials are not configured.")

        try:
            import requests
        except ImportError:
            return PublishResult(
                success=False,
                error="The 'requests' package is required to post to LinkedIn. Install it with `pip install requests`.",
            )

        body = {
            "author": self._settings.linkedin_author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": content.full_text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        headers = {
            "Authorization": f"Bearer {self._settings.linkedin_access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

        try:
            response = requests.post(_UGC_POSTS_URL, json=body, headers=headers, timeout=15)
            if response.status_code in (200, 201):
                return PublishResult(success=True, external_id=response.headers.get("x-restli-id"))
            return PublishResult(success=False, error=f"HTTP {response.status_code}: {response.text}")
        except Exception as exc:  # noqa: BLE001
            return PublishResult(success=False, error=str(exc))
