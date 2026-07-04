"""Persistence for post history (de-dup + audit log) and pending drafts."""

from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import closing
from dataclasses import asdict, dataclass
from pathlib import Path

from .content_generator import PostContent


@dataclass(frozen=True)
class PostRecord:
    content_hash: str
    topic: str
    platform: str
    text: str
    status: str  # "posted" | "failed" | "draft"
    created_at: float
    external_id: str | None = None
    error: str | None = None


class PostHistory:
    """SQLite-backed log of every post attempt, used to avoid duplicate posts."""

    def __init__(self, db_path: Path):
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self._db_path)

    def _init_db(self) -> None:
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS post_history (
                    content_hash TEXT PRIMARY KEY,
                    topic TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    text TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    external_id TEXT,
                    error TEXT
                )
                """
            )

    def has_posted(self, content: PostContent) -> bool:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT 1 FROM post_history WHERE content_hash = ? AND status = 'posted'",
                (content.content_hash,),
            ).fetchone()
        return row is not None

    def record(self, record: PostRecord) -> None:
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """
                INSERT INTO post_history
                    (content_hash, topic, platform, text, status, created_at, external_id, error)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(content_hash) DO UPDATE SET
                    status = excluded.status,
                    created_at = excluded.created_at,
                    external_id = excluded.external_id,
                    error = excluded.error
                """,
                (
                    record.content_hash,
                    record.topic,
                    record.platform,
                    record.text,
                    record.status,
                    record.created_at,
                    record.external_id,
                    record.error,
                ),
            )

    def recent(self, limit: int = 20) -> list[PostRecord]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT content_hash, topic, platform, text, status, created_at, external_id, error "
                "FROM post_history ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [PostRecord(*row) for row in rows]


class DraftStore:
    """Stores generated content awaiting human approval as JSON files."""

    def __init__(self, drafts_dir: Path):
        self._drafts_dir = drafts_dir
        self._drafts_dir.mkdir(parents=True, exist_ok=True)

    def save(self, content: PostContent) -> str:
        draft_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
        path = self._drafts_dir / f"{draft_id}.json"
        payload = {"draft_id": draft_id, **asdict(content)}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return draft_id

    def load(self, draft_id: str) -> PostContent:
        path = self._drafts_dir / f"{draft_id}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        return PostContent(topic=data["topic"], platform=data["platform"], text=data["text"], hashtags=data.get("hashtags", []))

    def delete(self, draft_id: str) -> None:
        path = self._drafts_dir / f"{draft_id}.json"
        path.unlink(missing_ok=True)

    def list_drafts(self) -> list[str]:
        return sorted(p.stem for p in self._drafts_dir.glob("*.json"))


class ContentQueue:
    """Simple JSON-file-backed queue of scheduled posting jobs.

    Each entry looks like:
        {"topic": "...", "platform": "twitter", "interval_minutes": 60, "tone": "friendly"}
    """

    def __init__(self, queue_path: Path):
        self._queue_path = queue_path

    def load(self) -> list[dict]:
        if not self._queue_path.exists():
            return []
        return json.loads(self._queue_path.read_text(encoding="utf-8"))

    def save(self, entries: list[dict]) -> None:
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)
        self._queue_path.write_text(json.dumps(entries, indent=2), encoding="utf-8")
