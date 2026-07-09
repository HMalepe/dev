"""Runs recurring posting jobs defined in the content queue (data/content_queue.json)."""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

from .config import get_settings
from .pipeline import PipelineResult, PostingPipeline
from .storage import ContentQueue, StorageError

logger = logging.getLogger(__name__)


@dataclass
class SchedulerRunResult:
    succeeded: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)

    @property
    def has_failures(self) -> bool:
        return bool(self.failed)

    @property
    def ran_any(self) -> bool:
        return bool(self.succeeded or self.failed or self.skipped)


class Scheduler:
    """Periodically runs each queue entry on its own interval.

    Entries are keyed by a stable ``job_id`` (auto-assigned when missing) so
    reordering the queue does not corrupt schedule timing. Last-run timestamps
    are persisted to ``data/scheduler_state.json``.
    """

    def __init__(self, pipeline: PostingPipeline | None = None, tick_seconds: int = 60):
        self.pipeline = pipeline or PostingPipeline(get_settings())
        self.queue = ContentQueue(self.pipeline.settings.queue_file_path)
        self.tick_seconds = tick_seconds
        self._state_path: Path = self.pipeline.settings.data_dir / "scheduler_state.json"
        self._last_run: dict[str, float] = self._load_state()

    def _load_state(self) -> dict[str, float]:
        if not self._state_path.exists():
            return {}
        try:
            raw = json.loads(self._state_path.read_text(encoding="utf-8"))
            migrated: dict[str, float] = {}
            for key, value in raw.items():
                if key.startswith("job-") or key.isdigit() is False:
                    migrated[str(key)] = float(value)
                else:
                    logger.warning("Ignoring legacy index-based scheduler state key %r", key)
            return migrated
        except (json.JSONDecodeError, TypeError, ValueError):
            logger.warning("Could not read scheduler state from %s; starting fresh.", self._state_path)
            return {}

    def _save_state(self) -> None:
        self._state_path.parent.mkdir(parents=True, exist_ok=True)
        self._state_path.write_text(json.dumps(self._last_run, indent=2), encoding="utf-8")

    def _job_label(self, entry: dict) -> str:
        return str(entry.get("job_id") or entry.get("topic") or "unnamed-job")

    def _run_entry(self, entry: dict) -> PipelineResult:
        media_path = entry.get("media_path")
        topic = entry.get("topic")
        text = entry.get("text")
        platform = entry.get("platform", "twitter")
        auto_publish = entry.get("auto_approve")

        if media_path and text is not None:
            return self.pipeline.publish_existing(
                topic=topic or "scheduled media",
                platform=platform,
                text=text,
                media_path=media_path,
                title=entry.get("title"),
                hashtags=entry.get("hashtags"),
                auto_publish=auto_publish,
            )

        if not topic:
            raise ValueError("Queue entry is missing required 'topic' field.")

        return self.pipeline.run_once(
            topic=topic,
            platform=platform,
            tone=entry.get("tone", "friendly"),
            hashtags=entry.get("hashtags"),
            media_path=media_path,
            title=entry.get("title"),
            auto_publish=auto_publish,
        )

    def run_due_jobs(self) -> SchedulerRunResult:
        """Run queue entries whose interval has elapsed."""
        outcome = SchedulerRunResult()
        try:
            entries = self.queue.ensure_job_ids()
        except StorageError as exc:
            logger.exception("Could not load content queue")
            outcome.failed.append(f"queue: {exc}")
            return outcome

        now = time.time()
        for entry in entries:
            job_id = entry["job_id"]
            label = self._job_label(entry)
            interval_seconds = entry.get("interval_minutes", 60) * 60
            last_run = self._last_run.get(job_id, 0)
            if now - last_run < interval_seconds:
                continue

            try:
                result = self._run_entry(entry)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Failed to run scheduled job %r", label)
                outcome.failed.append(f"{label}: {exc}")
                continue

            if result.status == "posted":
                self._last_run[job_id] = now
                self._save_state()
                outcome.succeeded.append(label)
            elif result.status == "skipped_duplicate":
                self._last_run[job_id] = now
                self._save_state()
                outcome.skipped.append(label)
            elif result.status == "draft":
                outcome.skipped.append(f"{label} (saved draft)")
            else:
                outcome.failed.append(f"{label}: {result.error or result.status}")

        return outcome

    def run_forever(self) -> None:  # pragma: no cover
        logger.info("Scheduler started; polling every %ss", self.tick_seconds)
        while True:
            self.run_due_jobs()
            time.sleep(self.tick_seconds)
