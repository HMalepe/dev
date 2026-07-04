"""Abstract interface all social platform adapters must implement."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..content_generator import PostContent


@dataclass(frozen=True)
class PublishResult:
    success: bool
    external_id: str | None = None
    error: str | None = None


class Platform(ABC):
    """A destination the pipeline can publish :class:`PostContent` to."""

    name: str = "base"

    def __init__(self, settings):
        self._settings = settings

    @abstractmethod
    def publish(self, content: PostContent) -> PublishResult:
        """Publish the content and return the result. Must not raise on
        expected failures (auth errors, rate limits) -- return a failed
        PublishResult instead so the pipeline can log it and move on."""

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether credentials required by this platform are present."""
