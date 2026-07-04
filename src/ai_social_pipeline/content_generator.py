"""Generates social-media-ready post copy using an LLM, with an offline fallback."""

from __future__ import annotations

import hashlib
import textwrap
from dataclasses import dataclass, field

from .config import Settings


@dataclass(frozen=True)
class PostContent:
    """A single generated piece of content, ready for review or publishing."""

    topic: str
    platform: str
    text: str
    hashtags: list[str] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        if not self.hashtags:
            return self.text
        return f"{self.text}\n\n{' '.join(self.hashtags)}"

    @property
    def content_hash(self) -> str:
        """Stable fingerprint used for de-duplication in the history store."""
        return hashlib.sha256(self.full_text.encode("utf-8")).hexdigest()


_PLATFORM_LIMITS = {
    "twitter": 280,
    "linkedin": 3000,
    "mock": 10_000,
}

_TEMPLATES = [
    "Excited to share some thoughts on {topic}! Here's what's on my mind today.",
    "Quick take on {topic}: it's changing faster than most people realize.",
    "If you're not paying attention to {topic} yet, now is a great time to start.",
    "Three things I learned this week about {topic} that surprised me.",
    "{topic} is one of those areas where small experiments lead to big insights.",
]


class ContentGenerator:
    """Wraps an LLM provider to draft platform-appropriate post copy.

    When no ``OPENAI_API_KEY`` is configured (e.g. local dev, CI, tests), a
    deterministic offline template is used instead so the rest of the
    pipeline can still be exercised end-to-end without network access.
    """

    def __init__(self, settings: Settings):
        self._settings = settings

    def generate(self, topic: str, platform: str = "twitter", tone: str = "friendly", hashtags: list[str] | None = None) -> PostContent:
        platform = platform.lower()
        limit = _PLATFORM_LIMITS.get(platform, 500)

        if self._settings.openai_api_key:
            text = self._generate_with_openai(topic=topic, platform=platform, tone=tone, limit=limit)
        else:
            text = self._generate_offline(topic=topic, limit=limit)

        return PostContent(topic=topic, platform=platform, text=text, hashtags=hashtags or [])

    def _generate_offline(self, topic: str, limit: int) -> str:
        index = int(hashlib.sha1(topic.encode("utf-8")).hexdigest(), 16) % len(_TEMPLATES)
        text = _TEMPLATES[index].format(topic=topic)
        return textwrap.shorten(text, width=limit, placeholder="...")

    def _generate_with_openai(self, topic: str, platform: str, tone: str, limit: int) -> str:
        try:
            from openai import OpenAI
        except ImportError as exc:  # pragma: no cover - exercised only without the dep installed
            raise RuntimeError(
                "The 'openai' package is required to generate content with an API key. "
                "Install it with `pip install openai`, or unset OPENAI_API_KEY to use the "
                "offline template generator."
            ) from exc

        client = OpenAI(api_key=self._settings.openai_api_key)
        prompt = (
            f"Write a {tone} social media post for {platform} about: {topic}. "
            f"Keep it under {limit} characters, no hashtags, no quotation marks."
        )
        response = client.chat.completions.create(
            model=self._settings.openai_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.8,
        )
        text = response.choices[0].message.content.strip()
        return textwrap.shorten(text, width=limit, placeholder="...")
