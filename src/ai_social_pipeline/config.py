"""Central configuration loaded from environment variables (.env supported)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    # Loading .env is optional; the app also works with real env vars only
    # (e.g. in CI/production where secrets are injected directly).
    from dotenv import load_dotenv

    load_dotenv(override=False)
except ImportError:  # pragma: no cover - dotenv is a lightweight dev convenience
    pass

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _default_data_dir() -> Path:
    return Path(os.getenv("PIPELINE_DATA_DIR", PROJECT_ROOT / "data"))


def _default_drafts_dir() -> Path:
    return Path(os.getenv("PIPELINE_DRAFTS_DIR", PROJECT_ROOT / "drafts"))


def _default_history_db_path() -> Path:
    env_value = os.getenv("PIPELINE_HISTORY_DB")
    return Path(env_value) if env_value else _default_data_dir() / "post_history.db"


def _default_queue_file_path() -> Path:
    env_value = os.getenv("PIPELINE_QUEUE_FILE")
    return Path(env_value) if env_value else _default_data_dir() / "content_queue.json"


@dataclass(frozen=True)
class Settings:
    """Runtime configuration for the pipeline.

    All fields are read fresh from the environment each time a ``Settings``
    instance is constructed (rather than cached at module-import time), so
    tests can safely monkeypatch environment variables per-case.
    """

    openai_api_key: str | None = field(default_factory=lambda: os.getenv("OPENAI_API_KEY"))
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini"))

    twitter_api_key: str | None = field(default_factory=lambda: os.getenv("TWITTER_API_KEY"))
    twitter_api_secret: str | None = field(default_factory=lambda: os.getenv("TWITTER_API_SECRET"))
    twitter_access_token: str | None = field(default_factory=lambda: os.getenv("TWITTER_ACCESS_TOKEN"))
    twitter_access_secret: str | None = field(default_factory=lambda: os.getenv("TWITTER_ACCESS_SECRET"))

    linkedin_access_token: str | None = field(default_factory=lambda: os.getenv("LINKEDIN_ACCESS_TOKEN"))
    linkedin_author_urn: str | None = field(default_factory=lambda: os.getenv("LINKEDIN_AUTHOR_URN"))

    youtube_client_id: str | None = field(default_factory=lambda: os.getenv("YOUTUBE_CLIENT_ID"))
    youtube_client_secret: str | None = field(default_factory=lambda: os.getenv("YOUTUBE_CLIENT_SECRET"))
    youtube_refresh_token: str | None = field(default_factory=lambda: os.getenv("YOUTUBE_REFRESH_TOKEN"))
    youtube_privacy_status: str = field(default_factory=lambda: os.getenv("YOUTUBE_PRIVACY_STATUS", "public"))
    youtube_category_id: str = field(default_factory=lambda: os.getenv("YOUTUBE_CATEGORY_ID", "22"))

    tiktok_access_token: str | None = field(default_factory=lambda: os.getenv("TIKTOK_ACCESS_TOKEN"))
    tiktok_privacy_level: str = field(default_factory=lambda: os.getenv("TIKTOK_PRIVACY_LEVEL", "PUBLIC_TO_EVERYONE"))

    auto_approve: bool = field(default_factory=lambda: _bool_env("PIPELINE_AUTO_APPROVE", False))
    dry_run: bool = field(default_factory=lambda: _bool_env("PIPELINE_DRY_RUN", True))

    data_dir: Path = field(default_factory=_default_data_dir)
    drafts_dir: Path = field(default_factory=_default_drafts_dir)
    history_db_path: Path = field(default_factory=_default_history_db_path)
    queue_file_path: Path = field(default_factory=_default_queue_file_path)

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.drafts_dir.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """Return a freshly-read Settings instance (cheap; safe to call often)."""
    settings = Settings()
    settings.ensure_directories()
    return settings
