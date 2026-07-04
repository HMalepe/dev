"""A no-op platform used for local testing, dry runs, and CI."""

from __future__ import annotations

import uuid

from ..content_generator import PostContent
from .base import Platform, PublishResult


class MockPlatform(Platform):
    """Records posts in-memory instead of calling a real API.

    Useful for demoing the pipeline end-to-end (`PIPELINE_DRY_RUN=true`)
    without any credentials configured.
    """

    name = "mock"

    def __init__(self, settings):
        super().__init__(settings)
        self.published: list[PostContent] = []

    def is_configured(self) -> bool:
        return True

    def publish(self, content: PostContent) -> PublishResult:
        self.published.append(content)
        return PublishResult(success=True, external_id=f"mock-{uuid.uuid4().hex[:10]}")
