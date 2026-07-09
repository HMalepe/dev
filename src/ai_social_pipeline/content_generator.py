"""Generates social-media-ready post copy using an LLM, with an offline fallback."""

from __future__ import annotations

import hashlib
import re
import textwrap
from dataclasses import dataclass, field

from .config import Settings


class ContentGenerationError(Exception):
    """Raised when AI content generation fails."""


@dataclass(frozen=True)
class PostContent:
    """A single generated piece of content, ready for review or publishing."""

    topic: str
    platform: str
    text: str
    hashtags: list[str] = field(default_factory=list)
    media_path: str | None = None
    title: str | None = None

    @property
    def full_text(self) -> str:
        if not self.hashtags:
            return self.text
        return f"{self.text}\n\n{' '.join(self.hashtags)}"

    @property
    def content_hash(self) -> str:
        """Stable fingerprint used for de-duplication in the history store."""
        fingerprint = "|".join(
            [
                self.full_text,
                self.media_path or "",
                self.title or "",
                self.platform,
            ]
        )
        return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


_PLATFORM_LIMITS = {
    "twitter": 280,
    "linkedin": 3000,
    "youtube": 5000,
    "tiktok": 2200,
    "mock": 10_000,
}

_TEMPLATES = [
    "Excited to share some thoughts on {topic}! Here's what's on my mind today.",
    "Quick take on {topic}: it's changing faster than most people realize.",
    "If you're not paying attention to {topic} yet, now is a great time to start.",
    "Three things I learned this week about {topic} that surprised me.",
    "{topic} is one of those areas where small experiments lead to big insights.",
]


def platform_char_limit(platform: str) -> int:
    return _PLATFORM_LIMITS.get(platform.lower(), 500)


def fit_text_to_platform(text: str, hashtags: list[str], limit: int) -> str:
    """Trim body text so text + hashtags stay within the platform limit."""
    if not hashtags:
        return textwrap.shorten(text, width=limit, placeholder="...")

    hashtag_block = " ".join(hashtags)
    separator = "\n\n"
    reserved = len(separator) + len(hashtag_block)
    if reserved >= limit:
        return textwrap.shorten(hashtag_block, width=limit, placeholder="...")
    body_limit = max(1, limit - reserved)
    return textwrap.shorten(text, width=body_limit, placeholder="...")


def _safe_topic_for_template(topic: str) -> str:
    return topic.replace("{", "{{").replace("}", "}}")


class ContentGenerator:
    """Wraps an LLM provider to draft platform-appropriate post copy."""

    def __init__(self, settings: Settings):
        self._settings = settings

    def generate(self, topic: str, platform: str = "twitter", tone: str = "friendly", hashtags: list[str] | None = None) -> PostContent:
        platform = platform.lower()
        limit = platform_char_limit(platform)
        tags = hashtags or []

        if self._settings.openai_api_key:
            text = self._generate_with_openai(topic=topic, platform=platform, tone=tone, limit=limit, hashtags=tags)
        else:
            text = self._generate_offline(topic=topic, limit=limit, hashtags=tags)

        return PostContent(topic=topic, platform=platform, text=text, hashtags=tags)

    def _generate_offline(self, topic: str, limit: int, hashtags: list[str]) -> str:
        index = int(hashlib.sha1(topic.encode("utf-8")).hexdigest(), 16) % len(_TEMPLATES)
        text = _TEMPLATES[index].format(topic=_safe_topic_for_template(topic))
        return fit_text_to_platform(text, hashtags, limit)

    def _generate_with_openai(self, topic: str, platform: str, tone: str, limit: int, hashtags: list[str]) -> str:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "The 'openai' package is required to generate content with an API key. "
                "Install it with `pip install openai`, or unset OPENAI_API_KEY to use the "
                "offline template generator."
            ) from exc

        safe_topic = re.sub(r"[\x00-\x1f\x7f]", " ", topic).strip()
        client = OpenAI(api_key=self._settings.openai_api_key)
        prompt = (
            f"Write a {tone} social media post for {platform} about: {safe_topic}. "
            f"Keep it under {limit} characters, no hashtags, no quotation marks."
        )
        try:
            response = client.chat.completions.create(
                model=self._settings.openai_model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.8,
            )
        except Exception as exc:  # noqa: BLE001
            raise ContentGenerationError(f"OpenAI content generation failed: {exc}") from exc

        message = response.choices[0].message.content
        if not message:
            raise ContentGenerationError("OpenAI returned an empty response.")
        text = message.strip()
        return fit_text_to_platform(text, hashtags, limit)
