from ai_social_pipeline.content_generator import ContentGenerator, PostContent, fit_text_to_platform


def test_offline_generation_is_deterministic(settings):
    generator = ContentGenerator(settings)
    first = generator.generate(topic="AI newsletters", platform="twitter")
    second = generator.generate(topic="AI newsletters", platform="twitter")

    assert first.text == second.text
    assert first.content_hash == second.content_hash


def test_generation_respects_platform_character_limit(settings):
    generator = ContentGenerator(settings)
    content = generator.generate(topic="a" * 500, platform="twitter")

    assert len(content.full_text) <= 280


def test_hashtags_included_in_full_text(settings):
    generator = ContentGenerator(settings)
    content = generator.generate(topic="growth marketing", platform="mock", hashtags=["#Growth", "#Marketing"])

    assert "#Growth" in content.full_text
    assert "#Marketing" in content.full_text
    assert content.text not in content.hashtags


def test_content_hash_changes_when_media_attached(settings):
    generator = ContentGenerator(settings)
    base = generator.generate(topic="launch", platform="youtube")
    with_media = PostContent(
        topic=base.topic,
        platform=base.platform,
        text=base.text,
        hashtags=base.hashtags,
        media_path="clip-a.mp4",
    )

    assert base.content_hash != with_media.content_hash


def test_fit_text_to_platform_accounts_for_hashtags():
    text = fit_text_to_platform("x" * 300, ["#Growth"], limit=280)

    assert len(f"{text}\n\n#Growth") <= 280


def test_offline_template_handles_braces_in_topic(settings):
    generator = ContentGenerator(settings)
    content = generator.generate(topic="C++ {templates}", platform="twitter")

    assert "{" not in content.text or "C++" in content.text
