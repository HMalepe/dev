"""Orchestrates generation -> (optional approval) -> publishing -> logging."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, replace

from .config import Settings, get_settings
from .content_generator import ContentGenerator, PostContent
from .platforms import PLATFORM_REGISTRY
from .platforms.base import Platform
from .storage import DraftStore, PostHistory, PostRecord

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    content: PostContent
    status: str  # "posted" | "draft" | "skipped_duplicate" | "failed"
    draft_id: str | None = None
    external_id: str | None = None
    error: str | None = None


class PostingPipeline:
    """The main entry point tying every component together."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.generator = ContentGenerator(self.settings)
        self.history = PostHistory(self.settings.history_db_path)
        self.drafts = DraftStore(self.settings.drafts_dir)

    def _get_platform(self, platform_name: str) -> Platform:
        platform_cls = PLATFORM_REGISTRY.get(platform_name.lower())
        if platform_cls is None:
            raise ValueError(
                f"Unknown platform '{platform_name}'. Available: {', '.join(sorted(PLATFORM_REGISTRY))}"
            )
        return platform_cls(self.settings)

    def generate(self, topic: str, platform: str = "twitter", tone: str = "friendly", hashtags: list[str] | None = None) -> PostContent:
        return self.generator.generate(topic=topic, platform=platform, tone=tone, hashtags=hashtags)

    def run_once(
        self,
        topic: str,
        platform: str = "twitter",
        tone: str = "friendly",
        hashtags: list[str] | None = None,
        auto_publish: bool | None = None,
        media_path: str | None = None,
        title: str | None = None,
    ) -> PipelineResult:
        """Generate one piece of content and either publish it or save it as a draft.

        ``auto_publish`` overrides ``settings.auto_approve`` when provided.
        """
        content = self.generate(topic=topic, platform=platform, tone=tone, hashtags=hashtags)
        if media_path is not None or title is not None:
            content = replace(
                content,
                media_path=media_path,
                title=title or content.title or content.topic,
            )

        if self.history.has_posted(content):
            logger.info("Skipping duplicate content for topic=%r platform=%r", topic, platform)
            return PipelineResult(content=content, status="skipped_duplicate")

        should_publish = self.settings.auto_approve if auto_publish is None else auto_publish
        if not should_publish:
            draft_id = self.drafts.save(content)
            self.history.record(
                PostRecord(
                    content_hash=content.content_hash,
                    topic=content.topic,
                    platform=content.platform,
                    text=content.full_text,
                    status="draft",
                    created_at=time.time(),
                )
            )
            return PipelineResult(content=content, status="draft", draft_id=draft_id)

        return self.publish(content)

    def publish(self, content: PostContent) -> PipelineResult:
        platform = self._get_platform(content.platform)
        result = platform.publish(content)

        status = "posted" if result.success else "failed"
        self.history.record(
            PostRecord(
                content_hash=content.content_hash,
                topic=content.topic,
                platform=content.platform,
                text=content.full_text,
                status=status,
                created_at=time.time(),
                external_id=result.external_id,
                error=result.error,
            )
        )
        return PipelineResult(
            content=content,
            status=status,
            external_id=result.external_id,
            error=result.error,
        )

    def publish_existing(
        self,
        *,
        topic: str,
        platform: str,
        text: str,
        media_path: str,
        title: str | None = None,
        hashtags: list[str] | None = None,
    ) -> PipelineResult:
        """Publish pre-made media without running the AI content generator."""
        content = PostContent(
            topic=topic,
            platform=platform,
            text=text,
            hashtags=hashtags or [],
            media_path=media_path,
            title=title or topic,
        )

        if self.history.has_posted(content):
            logger.info("Skipping duplicate media post for topic=%r platform=%r", topic, platform)
            return PipelineResult(content=content, status="skipped_duplicate")

        return self.publish(content)

    def approve_draft(self, draft_id: str) -> PipelineResult:
        content = self.drafts.load(draft_id)
        result = self.publish(content)
        self.drafts.delete(draft_id)
        return result
