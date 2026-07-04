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


def test_unknown_platform_raises(settings):
    pipeline = PostingPipeline(settings)

    try:
        pipeline._get_platform("not-a-real-platform")
        assert False, "expected ValueError"
    except ValueError:
        pass
