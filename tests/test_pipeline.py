from ai_social_pipeline.pipeline import PostingPipeline


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

    draft_again = pipeline.run_once(topic="already live", platform="mock")
    retry = pipeline.approve_draft(draft_again.draft_id)

    assert retry.status == "skipped_duplicate"
