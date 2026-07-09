"""Shared helpers for validating and uploading media files."""

from __future__ import annotations

from pathlib import Path

_VIDEO_SUFFIXES = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def resolve_media_path(path: str | None) -> tuple[Path | None, str | None]:
    """Return a resolved path, or (None, error_message) on failure."""
    if not path:
        return None, None

    resolved = Path(path).expanduser().resolve()
    if not resolved.exists():
        return None, f"Media file not found: {path}"
    if not resolved.is_file():
        return None, f"Media path is not a file: {path}"
    return resolved, None


def media_kind(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in _VIDEO_SUFFIXES:
        return "video"
    if suffix in _IMAGE_SUFFIXES:
        return "image"
    return "unknown"
