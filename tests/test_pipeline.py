from ai_social_pipeline.pipeline import PostingPipeline


def test_run_once_saves_draft_by_default(settings):
    pipeline = PostingPipeline(settings)
    result = pipeline.run_once(topic="new product launch", platform="mock")

    assert result.status == "draft"
    assert result.draft_id in pipeline.drafts.list_drafts()


def test_run_once_auto_publishes_when_requested(settings):
    pipeline = PostingPipeline(settings)
    result = pipeline.run_once(topic="new product launch", platform="mock", auto_publish=True)

    assert result.status == "posted"
    assert result.external_id is not None
    assert pipeline.history.has_posted(result.content)


def test_run_once_skips_duplicate_content(settings):
    pipeline = PostingPipeline(settings)
    pipeline.run_once(topic="evergreen tip", platform="mock", auto_publish=True)

    result = pipeline.run_once(topic="evergreen tip", platform="mock", auto_publish=True)

    assert result.status == "skipped_duplicate"


def test_approve_draft_publishes_and_removes_draft(settings):
    pipeline = PostingPipeline(settings)
    draft_result = pipeline.run_once(topic="behind the scenes", platform="mock")

    approve_result = pipeline.approve_draft(draft_result.draft_id)

    assert approve_result.status == "posted"
    assert draft_result.draft_id not in pipeline.drafts.list_drafts()


def test_approve_draft_keeps_draft_on_failure(settings, monkeypatch):
    pipeline = PostingPipeline(settings)
    draft_result = pipeline.run_once(topic="fail case", platform="mock")

    def fail_publish(content):
        from ai_social_pipeline.pipeline import PipelineResult

        return PipelineResult(content=content, status="failed", error="boom")

    monkeypatch.setattr(pipeline, "publish", fail_publish)

    result = pipeline.approve_draft(draft_result.draft_id)

    assert result.status == "failed"
    assert draft_result.draft_id in pipeline.drafts.list_drafts()


def test_publish_existing_respects_auto_approve(settings, tmp_path):
    media_file = tmp_path / "clip.mp4"
    media_file.write_bytes(b"fake-video")

    pipeline = PostingPipeline(settings)
    result = pipeline.publish_existing(
        topic="launch clip",
        platform="mock",
        text="caption",
        media_path=str(media_file),
        title="Launch",
        auto_publish=False,
    )

    assert result.status == "draft"
    assert result.draft_id in pipeline.drafts.list_drafts()


def test_unknown_platform_raises(settings):
    pipeline = PostingPipeline(settings)

    try:
        pipeline._get_platform("not-a-real-platform")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_run_once_returns_failed_on_generation_error(settings, monkeypatch):
    pipeline = PostingPipeline(settings)

    def boom(*_args, **_kwargs):
        from ai_social_pipeline.content_generator import ContentGenerationError

        raise ContentGenerationError("api down")

    monkeypatch.setattr(pipeline.generator, "generate", boom)

    result = pipeline.run_once(topic="broken", platform="mock")

    assert result.status == "failed"
    assert "api down" in result.error


def test_approve_draft_skips_already_posted_content(settings):
    pipeline = PostingPipeline(settings)
    draft_result = pipeline.run_once(topic="already live", platform="mock")
    pipeline.approve_draft(draft_result.draft_id)

    content = pipeline.generator.generate(topic="already live", platform="mock")
    draft_id = pipeline.drafts.save(content)
    retry = pipeline.approve_draft(draft_id)

    assert retry.status == "skipped_duplicate"
    assert draft_id not in pipeline.drafts.list_drafts()
