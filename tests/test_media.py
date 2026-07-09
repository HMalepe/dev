from pathlib import Path

import pytest

from ai_social_pipeline.platforms.media import media_kind, resolve_media_path


def test_resolve_media_path_missing():
    path, error = resolve_media_path("/does/not/exist.mp4")

    assert path is None
    assert error is not None


def test_resolve_media_path_success(tmp_path):
    media = tmp_path / "clip.mp4"
    media.write_bytes(b"video")

    path, error = resolve_media_path(str(media))

    assert error is None
    assert path == media.resolve()


def test_media_kind_detects_video_and_image(tmp_path):
    video = tmp_path / "a.mp4"
    image = tmp_path / "b.png"
    video.write_bytes(b"v")
    image.write_bytes(b"i")

    assert media_kind(video) == "video"
    assert media_kind(image) == "image"
    assert media_kind(tmp_path / "file.xyz") == "unknown"
