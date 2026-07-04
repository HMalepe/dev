"""Social platform adapters.

Each adapter implements the :class:`Platform` interface defined in
``base.py`` so the pipeline can publish to any of them interchangeably.
"""

from .base import Platform, PublishResult
from .linkedin import LinkedInPlatform
from .mock import MockPlatform
from .twitter import TwitterPlatform

PLATFORM_REGISTRY: dict[str, type[Platform]] = {
    "mock": MockPlatform,
    "twitter": TwitterPlatform,
    "linkedin": LinkedInPlatform,
}

__all__ = [
    "Platform",
    "PublishResult",
    "MockPlatform",
    "TwitterPlatform",
    "LinkedInPlatform",
    "PLATFORM_REGISTRY",
]
