import time

import pytest

from ai_social_pipeline.content_generator import PostContent
from ai_social_pipeline.storage import (
    ContentQueue,
    DraftStore,
    PostHistory,
    PostRecord,
    StorageError,
    validate_draft_id,
)


def _content(text="hello world"):
    return PostContent(topic="topic", platform="mock", text=text)


def test_history_dedup(settings):
    history = PostHistory(settings.history_db_path)
    content = _content()

    assert history.has_posted(content) is False

    history.record(
        PostRecord(
            content_hash=content.content_hash,
            topic=content.topic,
            platform=content.platform,
            text=content.full_text,
            status="posted",
            created_at=time.time(),
            external_id="abc123",
        )
    )

    assert history.has_posted(content) is True


def test_history_stores_media_metadata(settings):
    history = PostHistory(settings.history_db_path)
    content = PostContent(
        topic="topic",
        platform="youtube",
        text="caption",
        media_path="clip.mp4",
        title="Title",
    )

    history.record(
        PostRecord(
            content_hash=content.content_hash,
            topic=content.topic,
            platform=content.platform,
            text=content.full_text,
            status="posted",
            created_at=time.time(),
            media_path=content.media_path,
            title=content.title,
        )
    )

    record = history.recent(limit=1)[0]
    assert record.media_path == "clip.mp4"
    assert record.title == "Title"


def test_draft_store_roundtrip(settings):
    drafts = DraftStore(settings.drafts_dir)
    content = PostContent(topic="topic", platform="mock", text="draft me", media_path="clip.mp4", title="Title")

    draft_id = drafts.save(content)
    assert draft_id in drafts.list_drafts()

    loaded = drafts.load(draft_id)
    assert loaded.text == content.text
    assert loaded.media_path == content.media_path
    assert loaded.title == content.title

    drafts.delete(draft_id)
    assert draft_id not in drafts.list_drafts()


def test_validate_draft_id_rejects_path_traversal():
    with pytest.raises(StorageError):
        validate_draft_id("../../etc/passwd")


def test_content_queue_roundtrip(settings):
    queue = ContentQueue(settings.queue_file_path)
    assert queue.load() == []

    entries = [{"job_id": "job-1", "topic": "t1", "platform": "mock", "interval_minutes": 30}]
    queue.save(entries)

    assert queue.load() == entries


def test_content_queue_rejects_invalid_json(settings):
    settings.queue_file_path.write_text("{not json", encoding="utf-8")
    queue = ContentQueue(settings.queue_file_path)

    with pytest.raises(StorageError):
        queue.load()
