from ai_social_pipeline.content_generator import ContentGenerator


def test_offline_generation_is_deterministic(settings):
    generator = ContentGenerator(settings)
    first = generator.generate(topic="AI newsletters", platform="twitter")
    second = generator.generate(topic="AI newsletters", platform="twitter")

    assert first.text == second.text
    assert first.content_hash == second.content_hash


def test_generation_respects_platform_character_limit(settings):
    generator = ContentGenerator(settings)
    content = generator.generate(topic="a" * 500, platform="twitter")

    assert len(content.text) <= 280


def test_hashtags_included_in_full_text(settings):
    generator = ContentGenerator(settings)
    content = generator.generate(topic="growth marketing", platform="mock", hashtags=["#Growth", "#Marketing"])

    assert "#Growth" in content.full_text
    assert "#Marketing" in content.full_text
    assert content.text not in content.hashtags
