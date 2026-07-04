"""Twitter/X adapter, built on top of the `tweepy` client library."""

from __future__ import annotations

from ..content_generator import PostContent
from .base import Platform, PublishResult


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
            client = tweepy.Client(
                consumer_key=self._settings.twitter_api_key,
                consumer_secret=self._settings.twitter_api_secret,
                access_token=self._settings.twitter_access_token,
                access_token_secret=self._settings.twitter_access_secret,
            )
            response = client.create_tweet(text=content.full_text)
            tweet_id = str(response.data.get("id")) if response and response.data else None
            return PublishResult(success=True, external_id=tweet_id)
        except Exception as exc:  # noqa: BLE001 - surface any API error to the caller
            return PublishResult(success=False, error=str(exc))
