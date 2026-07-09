"""Social platform adapters.

Each adapter implements the :class:`Platform` interface defined in
``base.py`` so the pipeline can publish to any of them interchangeably.
"""

from .base import Platform, PublishResult
from .linkedin import LinkedInPlatform
from .mock import MockPlatform
from .tiktok import TikTokPlatform
from .twitter import TwitterPlatform
from .youtube import YouTubePlatform

PLATFORM_REGISTRY: dict[str, type[Platform]] = {
    "mock": MockPlatform,
    "twitter": TwitterPlatform,
    "linkedin": LinkedInPlatform,
    "youtube": YouTubePlatform,
    "tiktok": TikTokPlatform,
}

__all__ = [
    "Platform",
    "PublishResult",
    "MockPlatform",
    "TwitterPlatform",
    "LinkedInPlatform",
    "YouTubePlatform",
    "TikTokPlatform",
    "PLATFORM_REGISTRY",
]
