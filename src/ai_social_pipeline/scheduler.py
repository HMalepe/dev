"""Runs recurring posting jobs defined in the content queue (data/content_queue.json)."""

from __future__ import annotations

import logging
import time

from .config import get_settings
from .pipeline import PostingPipeline
from .storage import ContentQueue

logger = logging.getLogger(__name__)


class Scheduler:
    """Periodically runs each queue entry on its own interval.

    Entries in the queue file look like:
        {"topic": "AI trends", "platform": "twitter", "tone": "friendly",
         "interval_minutes": 60}

    This is a lightweight polling scheduler (checked every ``tick_seconds``)
    rather than a full cron implementation, which keeps the dependency
    footprint small and behavior easy to reason about and test.
    """

    def __init__(self, pipeline: PostingPipeline | None = None, tick_seconds: int = 60):
        self.pipeline = pipeline or PostingPipeline(get_settings())
        self.queue = ContentQueue(self.pipeline.settings.queue_file_path)
        self.tick_seconds = tick_seconds
        self._last_run: dict[int, float] = {}

    def run_due_jobs(self) -> list[str]:
        """Runs any queue entries whose interval has elapsed. Returns topics run."""
        entries = self.queue.load()
        now = time.time()
        ran: list[str] = []

        for index, entry in enumerate(entries):
            interval_seconds = entry.get("interval_minutes", 60) * 60
            last_run = self._last_run.get(index, 0)
            if now - last_run < interval_seconds:
                continue

            self._last_run[index] = now
            try:
                self.pipeline.run_once(
                    topic=entry["topic"],
                    platform=entry.get("platform", "twitter"),
                    tone=entry.get("tone", "friendly"),
                    hashtags=entry.get("hashtags"),
                )
                ran.append(entry["topic"])
            except Exception:  # noqa: BLE001 - one bad job shouldn't kill the scheduler
                logger.exception("Failed to run scheduled job for topic=%r", entry.get("topic"))

        return ran

    def run_forever(self) -> None:  # pragma: no cover - infinite loop, exercised manually
        logger.info("Scheduler started; polling every %ss", self.tick_seconds)
        while True:
            self.run_due_jobs()
            time.sleep(self.tick_seconds)
