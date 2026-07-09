"""Twitter/X adapter, built on top of the `tweepy` client library."""

from __future__ import annotations

from ..content_generator import PostContent
from .base import Platform, PublishResult
from .media import media_kind, resolve_media_path


class TwitterPlatform(Platform):
    name = "twitter"

    def is_configured(self) -> bool:
        s = self._settings
        return bool(s.twitter_api_key and s.twitter_api_secret and s.twitter_access_token and s.twitter_access_secret)

    def publish(self, content: PostContent) -> PublishResult:
        if self._settings.dry_run:
            return PublishResult(success=True, external_id="dry-run")

        if not self.is_configured():
            return PublishResult(success=False, error="Twitter credentials are not configured.")

        try:
            import tweepy
        except ImportError:
            return PublishResult(
                success=False,
                error="The 'tweepy' package is required to post to Twitter. Install it with `pip install tweepy`.",
            )

        try:
            media_ids: list[str] = []
            media_path, media_error = resolve_media_path(content.media_path)
            if media_error:
                return PublishResult(success=False, error=media_error)

            if media_path is not None:
                if media_kind(media_path) != "image":
                    return PublishResult(
                        success=False,
                        error="Twitter/X media upload currently supports images only. Use YouTube or TikTok for video.",
                    )
                auth = tweepy.OAuth1UserHandler(
                    consumer_key=self._settings.twitter_api_key,
                    consumer_secret=self._settings.twitter_api_secret,
                    access_token=self._settings.twitter_access_token,
                    access_token_secret=self._settings.twitter_access_secret,
                )
                api_v1 = tweepy.API(auth)
                uploaded = api_v1.media_upload(filename=str(media_path))
                media_ids = [str(uploaded.media_id)]

            client = tweepy.Client(
                consumer_key=self._settings.twitter_api_key,
                consumer_secret=self._settings.twitter_api_secret,
                access_token=self._settings.twitter_access_token,
                access_token_secret=self._settings.twitter_access_secret,
            )
            response = client.create_tweet(text=content.full_text, media_ids=media_ids or None)
            tweet_id = str(response.data.get("id")) if response and response.data else None
            return PublishResult(success=True, external_id=tweet_id)
        except Exception as exc:  # noqa: BLE001 - surface any API error to the caller
            return PublishResult(success=False, error=str(exc))
