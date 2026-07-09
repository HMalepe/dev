"""Persistence for post history (de-dup + audit log) and pending drafts."""

from __future__ import annotations

import json
import re
import sqlite3
import time
import uuid
from contextlib import closing
from dataclasses import asdict, dataclass
from pathlib import Path

from .content_generator import PostContent

_DRAFT_ID_PATTERN = re.compile(r"^[0-9]+-[a-f0-9]{8}$")


class StorageError(Exception):
    """Raised when persisted data cannot be read or written safely."""


def validate_draft_id(draft_id: str) -> str:
    """Reject draft ids that could escape the drafts directory."""
    if not draft_id or not _DRAFT_ID_PATTERN.fullmatch(draft_id):
        raise StorageError(
            f"Invalid draft id {draft_id!r}. Expected format like '1730000000-abcd1234'."
        )
    return draft_id


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
    media_path: str | None = None
    title: str | None = None


class PostHistory:
    """SQLite-backed log of every post attempt, used to avoid duplicate posts."""

    def __init__(self, db_path: Path):
        self._db_path = db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

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
                    error TEXT,
                    media_path TEXT,
                    title TEXT
                )
                """
            )
            columns = {row[1] for row in conn.execute("PRAGMA table_info(post_history)")}
            if "media_path" not in columns:
                conn.execute("ALTER TABLE post_history ADD COLUMN media_path TEXT")
            if "title" not in columns:
                conn.execute("ALTER TABLE post_history ADD COLUMN title TEXT")

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
                    (content_hash, topic, platform, text, status, created_at,
                     external_id, error, media_path, title)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(content_hash) DO UPDATE SET
                    status = excluded.status,
                    created_at = excluded.created_at,
                    external_id = excluded.external_id,
                    error = excluded.error,
                    media_path = excluded.media_path,
                    title = excluded.title
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
                    record.media_path,
                    record.title,
                ),
            )

    def recent(self, limit: int = 20) -> list[PostRecord]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT content_hash, topic, platform, text, status, created_at, "
                "external_id, error, media_path, title "
                "FROM post_history ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [PostRecord(*row) for row in rows]


class DraftStore:
    """Stores generated content awaiting human approval as JSON files."""

    def __init__(self, drafts_dir: Path):
        self._drafts_dir = drafts_dir
        self._drafts_dir.mkdir(parents=True, exist_ok=True)

    def _path_for(self, draft_id: str) -> Path:
        safe_id = validate_draft_id(draft_id)
        path = (self._drafts_dir / f"{safe_id}.json").resolve()
        if self._drafts_dir.resolve() not in path.parents:
            raise StorageError(f"Draft id {draft_id!r} resolves outside drafts directory.")
        return path

    def save(self, content: PostContent) -> str:
        draft_id = f"{int(time.time())}-{uuid.uuid4().hex[:8]}"
        path = self._drafts_dir / f"{draft_id}.json"
        payload = {"draft_id": draft_id, **asdict(content)}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return draft_id

    def load(self, draft_id: str) -> PostContent:
        path = self._path_for(draft_id)
        if not path.exists():
            raise StorageError(f"Draft not found: {draft_id}")
        data = json.loads(path.read_text(encoding="utf-8"))
        return PostContent(
            topic=data["topic"],
            platform=data["platform"],
            text=data["text"],
            hashtags=data.get("hashtags", []),
            media_path=data.get("media_path"),
            title=data.get("title"),
        )

    def delete(self, draft_id: str) -> None:
        self._path_for(draft_id).unlink(missing_ok=True)

    def list_drafts(self) -> list[str]:
        return sorted(p.stem for p in self._drafts_dir.glob("*.json"))


class ContentQueue:
    """Simple JSON-file-backed queue of scheduled posting jobs."""

    def __init__(self, queue_path: Path):
        self._queue_path = queue_path

    def load(self) -> list[dict]:
        if not self._queue_path.exists():
            return []
        try:
            data = json.loads(self._queue_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise StorageError(f"Invalid JSON in queue file {self._queue_path}: {exc}") from exc
        if not isinstance(data, list):
            raise StorageError(f"Queue file must contain a JSON array, got {type(data).__name__}.")
        return data

    def save(self, entries: list[dict]) -> None:
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)
        self._queue_path.write_text(json.dumps(entries, indent=2), encoding="utf-8")

    def ensure_job_ids(self) -> list[dict]:
        """Return queue entries, assigning persistent job_id values when missing."""
        entries = self.load()
        changed = False
        for entry in entries:
            if not entry.get("job_id"):
                entry["job_id"] = f"job-{uuid.uuid4().hex[:12]}"
                changed = True
        if changed:
            self.save(entries)
        return entries
