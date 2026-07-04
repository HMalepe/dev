import pytest

from ai_social_pipeline.config import Settings


@pytest.fixture
def settings(tmp_path, monkeypatch):
    """A Settings instance pointed at a temp dir, with no external API keys."""
    monkeypatch.setenv("PIPELINE_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PIPELINE_DRAFTS_DIR", str(tmp_path / "drafts"))
    monkeypatch.setenv("PIPELINE_HISTORY_DB", str(tmp_path / "data" / "post_history.db"))
    monkeypatch.setenv("PIPELINE_QUEUE_FILE", str(tmp_path / "data" / "content_queue.json"))
    for key in [
        "OPENAI_API_KEY",
        "TWITTER_API_KEY",
        "TWITTER_API_SECRET",
        "TWITTER_ACCESS_TOKEN",
        "TWITTER_ACCESS_SECRET",
        "LINKEDIN_ACCESS_TOKEN",
        "LINKEDIN_AUTHOR_URN",
    ]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("PIPELINE_AUTO_APPROVE", "false")
    monkeypatch.setenv("PIPELINE_DRY_RUN", "true")

    result = Settings()
    result.ensure_directories()
    return result
