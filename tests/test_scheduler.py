import json

from ai_social_pipeline.pipeline import PostingPipeline
from ai_social_pipeline.scheduler import Scheduler
from ai_social_pipeline.storage import ContentQueue


def test_publish_existing_posts_media_without_generation(settings, tmp_path):
    media_file = tmp_path / "clip.mp4"
    media_file.write_bytes(b"fake-video")

    pipeline = PostingPipeline(settings)
    result = pipeline.publish_existing(
        topic="launch clip",
        platform="mock",
        text="caption",
        media_path=str(media_file),
        title="Launch",
    )

    assert result.status == "posted"
    assert result.content.media_path == str(media_file)


def test_scheduler_persists_last_run(settings):
    queue = ContentQueue(settings.queue_file_path)
    queue.save(
        [
            {
                "topic": "daily tip",
                "platform": "mock",
                "interval_minutes": 60,
                "auto_approve": True,
            }
        ]
    )

    pipeline = PostingPipeline(settings)
    scheduler = Scheduler(pipeline=pipeline)

    first_run = scheduler.run_due_jobs()
    assert first_run == ["daily tip"]

    second_run = scheduler.run_due_jobs()
    assert second_run == []

    state_path = settings.data_dir / "scheduler_state.json"
    assert state_path.exists()
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert "0" in state
