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
        auto_publish=True,
    )

    assert result.status == "posted"
    assert result.content.media_path == str(media_file)


def test_scheduler_persists_last_run_by_job_id(settings):
    queue = ContentQueue(settings.queue_file_path)
    queue.save(
        [
            {
                "job_id": "daily-tip",
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
    assert first_run.succeeded == ["daily-tip"]

    second_run = scheduler.run_due_jobs()
    assert second_run.ran_any is False

    state_path = settings.data_dir / "scheduler_state.json"
    state = json.loads(state_path.read_text(encoding="utf-8"))
    assert "daily-tip" in state


def test_scheduler_marks_failed_jobs_without_advancing_state(settings, monkeypatch):
    queue = ContentQueue(settings.queue_file_path)
    queue.save(
        [
            {
                "job_id": "will-fail",
                "topic": "broken",
                "platform": "mock",
                "interval_minutes": 60,
                "auto_approve": True,
            }
        ]
    )

    pipeline = PostingPipeline(settings)
    scheduler = Scheduler(pipeline=pipeline)

    def fail_publish(content):
        from ai_social_pipeline.pipeline import PipelineResult

        return PipelineResult(content=content, status="failed", error="nope")

    monkeypatch.setattr(pipeline, "publish", fail_publish)

    outcome = scheduler.run_due_jobs()
    assert outcome.failed == ["will-fail: nope"]
    assert "will-fail" not in scheduler._last_run

    second = scheduler.run_due_jobs()
    assert second.failed == ["will-fail: nope"]


def test_scheduler_assigns_job_ids(settings):
    queue = ContentQueue(settings.queue_file_path)
    queue.save([{"topic": "auto id", "platform": "mock", "interval_minutes": 60, "auto_approve": True}])

    entries = queue.ensure_job_ids()
    assert entries[0]["job_id"].startswith("job-")
