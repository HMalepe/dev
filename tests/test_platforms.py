from ai_social_pipeline.content_generator import PostContent
from ai_social_pipeline.platforms.linkedin import LinkedInPlatform
from ai_social_pipeline.platforms.mock import MockPlatform
from ai_social_pipeline.platforms.twitter import TwitterPlatform


def test_mock_platform_always_succeeds(settings):
    platform = MockPlatform(settings)
    content = PostContent(topic="t", platform="mock", text="hello")

    result = platform.publish(content)

    assert result.success is True
    assert platform.published == [content]


def test_twitter_dry_run_short_circuits_before_credential_check(settings):
    platform = TwitterPlatform(settings)
    content = PostContent(topic="t", platform="twitter", text="hello")

    result = platform.publish(content)

    assert result.success is True
    assert result.external_id == "dry-run"


def test_twitter_reports_missing_credentials_when_not_dry_run(settings, monkeypatch):
    monkeypatch.setenv("PIPELINE_DRY_RUN", "false")
    from ai_social_pipeline.config import Settings

    live_settings = Settings()
    platform = TwitterPlatform(live_settings)
    content = PostContent(topic="t", platform="twitter", text="hello")

    result = platform.publish(content)

    assert result.success is False
    assert "not configured" in result.error


def test_linkedin_dry_run_short_circuits(settings):
    platform = LinkedInPlatform(settings)
    content = PostContent(topic="t", platform="linkedin", text="hello")

    result = platform.publish(content)

    assert result.success is True
    assert result.external_id == "dry-run"
