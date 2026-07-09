"""Runs recurring posting jobs defined in the content queue (data/content_queue.json)."""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from .config import get_settings
from .pipeline import PostingPipeline
from .storage import ContentQueue

logger = logging.getLogger(__name__)


class Scheduler:
    """Periodically runs each queue entry on its own interval.

    Entries in the queue file look like:
        {"topic": "AI trends", "platform": "twitter", "tone": "friendly",
         "interval_minutes": 60, "media_path": "videos/clip.mp4", "title": "My Short"}

    This is a lightweight polling scheduler (checked every ``tick_seconds``)
    rather than a full cron implementation, which keeps the dependency
    footprint small and behavior easy to reason about and test.

    Last-run timestamps are persisted to ``data/scheduler_state.json`` so cron
    and GitHub Actions can call :meth:`run_due_jobs` once per trigger.
    """

    def __init__(self, pipeline: PostingPipeline | None = None, tick_seconds: int = 60):
        self.pipeline = pipeline or PostingPipeline(get_settings())
        self.queue = ContentQueue(self.pipeline.settings.queue_file_path)
        self.tick_seconds = tick_seconds
        self._state_path: Path = self.pipeline.settings.data_dir / "scheduler_state.json"
        self._last_run: dict[int, float] = self._load_state()

    def _load_state(self) -> dict[int, float]:
        if not self._state_path.exists():
            return {}
        try:
            raw = json.loads(self._state_path.read_text(encoding="utf-8"))
            return {int(key): float(value) for key, value in raw.items()}
        except (json.JSONDecodeError, TypeError, ValueError):
            logger.warning("Could not read scheduler state from %s; starting fresh.", self._state_path)
            return {}

    def _save_state(self) -> None:
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {str(index): timestamp for index, timestamp in self._last_run.items()}
        self._state_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

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
            self._save_state()
            try:
                media_path = entry.get("media_path")
                if media_path and entry.get("text"):
                    self.pipeline.publish_existing(
                        topic=entry.get("topic", "scheduled media"),
                        platform=entry.get("platform", "twitter"),
                        text=entry["text"],
                        media_path=media_path,
                        title=entry.get("title"),
                        hashtags=entry.get("hashtags"),
                    )
                else:
                    self.pipeline.run_once(
                        topic=entry["topic"],
                        platform=entry.get("platform", "twitter"),
                        tone=entry.get("tone", "friendly"),
                        hashtags=entry.get("hashtags"),
                        media_path=media_path,
                        title=entry.get("title"),
                        auto_publish=entry.get("auto_approve"),
                    )
                ran.append(entry.get("topic", f"job-{index}"))
            except Exception:  # noqa: BLE001 - one bad job shouldn't kill the scheduler
                logger.exception("Failed to run scheduled job for topic=%r", entry.get("topic"))

        return ran

    def run_forever(self) -> None:  # pragma: no cover - infinite loop, exercised manually
        logger.info("Scheduler started; polling every %ss", self.tick_seconds)
        while True:
            self.run_due_jobs()
            time.sleep(self.tick_seconds)
