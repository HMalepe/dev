import time

from ai_social_pipeline.content_generator import PostContent
from ai_social_pipeline.storage import ContentQueue, DraftStore, PostHistory, PostRecord


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


def test_history_ignores_non_posted_status(settings):
    history = PostHistory(settings.history_db_path)
    content = _content()

    history.record(
        PostRecord(
            content_hash=content.content_hash,
            topic=content.topic,
            platform=content.platform,
            text=content.full_text,
            status="failed",
            created_at=time.time(),
            error="boom",
        )
    )

    assert history.has_posted(content) is False


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


def test_content_queue_roundtrip(settings):
    queue = ContentQueue(settings.queue_file_path)
    assert queue.load() == []

    entries = [{"topic": "t1", "platform": "mock", "interval_minutes": 30}]
    queue.save(entries)

    assert queue.load() == entries
