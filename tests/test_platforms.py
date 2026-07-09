from ai_social_pipeline.content_generator import PostContent
from ai_social_pipeline.platforms.linkedin import LinkedInPlatform
from ai_social_pipeline.platforms.mock import MockPlatform
from ai_social_pipeline.platforms.tiktok import TikTokPlatform
from ai_social_pipeline.platforms.twitter import TwitterPlatform
from ai_social_pipeline.platforms.youtube import YouTubePlatform


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


def test_youtube_dry_run_short_circuits(settings, tmp_path):
    media = tmp_path / "clip.mp4"
    media.write_bytes(b"video")
    platform = YouTubePlatform(settings)
    content = PostContent(topic="t", platform="youtube", text="hello", media_path=str(media))

    result = platform.publish(content)

    assert result.success is True
    assert result.external_id == "dry-run"


def test_youtube_requires_media_when_live(settings, monkeypatch):
    monkeypatch.setenv("PIPELINE_DRY_RUN", "false")
    from ai_social_pipeline.config import Settings

    live_settings = Settings()
    platform = YouTubePlatform(live_settings)
    content = PostContent(topic="t", platform="youtube", text="hello")

    result = platform.publish(content)

    assert result.success is False
    assert "requires a video file" in result.error


def test_tiktok_dry_run_short_circuits(settings, tmp_path):
    media = tmp_path / "clip.mp4"
    media.write_bytes(b"video")
    platform = TikTokPlatform(settings)
    content = PostContent(topic="t", platform="tiktok", text="hello", media_path=str(media))

    result = platform.publish(content)

    assert result.success is True
    assert result.external_id == "dry-run"


def test_tiktok_reports_missing_credentials_when_not_dry_run(settings, monkeypatch, tmp_path):
    media = tmp_path / "clip.mp4"
    media.write_bytes(b"video")
    monkeypatch.setenv("PIPELINE_DRY_RUN", "false")
    from ai_social_pipeline.config import Settings

    live_settings = Settings()
    platform = TikTokPlatform(live_settings)
    content = PostContent(topic="t", platform="tiktok", text="hello", media_path=str(media))

    result = platform.publish(content)

    assert result.success is False
    assert "not configured" in result.error
