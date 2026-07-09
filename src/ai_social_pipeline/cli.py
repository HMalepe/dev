"""Command-line interface for the pipeline."""

from __future__ import annotations

import click

from .config import get_settings
from .pipeline import PostingPipeline
from .scheduler import Scheduler

_PLATFORM_CHOICES = "twitter, linkedin, youtube, tiktok, mock"


def _echo_result(result) -> None:
    if result.status == "posted":
        click.echo(f"Posted to {result.content.platform}. External id: {result.external_id}")
    elif result.status == "draft":
        click.echo(f"Saved as draft '{result.draft_id}'. Approve with: approve --draft-id {result.draft_id}")
    elif result.status == "skipped_duplicate":
        click.echo("Skipped: identical content was already posted before.")
    else:
        click.echo(f"Failed to post: {result.error}", err=True)
        raise SystemExit(1)


@click.group()
def cli() -> None:
    """AI-powered social media automated posting pipeline."""


@cli.command()
@click.option("--topic", required=True, help="Subject to write about.")
@click.option("--platform", default="twitter", show_default=True, help=f"Target platform ({_PLATFORM_CHOICES}).")
@click.option("--tone", default="friendly", show_default=True, help="Tone of voice for the generated copy.")
@click.option("--hashtag", "hashtags", multiple=True, help="Hashtag to append (repeatable).")
def generate(topic: str, platform: str, tone: str, hashtags: tuple[str, ...]) -> None:
    """Generate content and print it, without saving or publishing."""
    pipeline = PostingPipeline(get_settings())
    try:
        content = pipeline.generate(topic=topic, platform=platform, tone=tone, hashtags=list(hashtags))
    except Exception as exc:  # noqa: BLE001
        click.echo(f"Failed to generate content: {exc}", err=True)
        raise SystemExit(1) from exc
    click.echo(content.full_text)


@cli.command()
@click.option("--topic", required=True, help="Subject to write about.")
@click.option("--platform", default="twitter", show_default=True, help=f"Target platform ({_PLATFORM_CHOICES}).")
@click.option("--tone", default="friendly", show_default=True, help="Tone of voice for the generated copy.")
@click.option("--hashtag", "hashtags", multiple=True, help="Hashtag to append (repeatable).")
@click.option("--media", "media_path", type=click.Path(exists=True, dir_okay=False), help="Video/image file to attach.")
@click.option("--title", help="Video title for YouTube/TikTok (defaults to topic).")
@click.option("--auto-approve/--no-auto-approve", default=None, help="Publish immediately instead of saving a draft.")
def post(
    topic: str,
    platform: str,
    tone: str,
    hashtags: tuple[str, ...],
    media_path: str | None,
    title: str | None,
    auto_approve: bool | None,
) -> None:
    """Generate content and either publish it or save it as a draft for review."""
    pipeline = PostingPipeline(get_settings())
    result = pipeline.run_once(
        topic=topic,
        platform=platform,
        tone=tone,
        hashtags=list(hashtags),
        auto_publish=auto_approve,
        media_path=media_path,
        title=title,
    )
    _echo_result(result)


@cli.command("publish-media")
@click.option("--platform", required=True, help=f"Target platform ({_PLATFORM_CHOICES}).")
@click.option("--media", "media_path", required=True, type=click.Path(exists=True, dir_okay=False), help="Video file.")
@click.option("--text", default="", show_default=True, help="Caption or description.")
@click.option("--title", help="Video title (defaults to topic).")
@click.option("--topic", default="media post", show_default=True, help="Internal label stored in post history.")
@click.option("--hashtag", "hashtags", multiple=True, help="Hashtag to append (repeatable).")
@click.option("--auto-approve/--no-auto-approve", default=True, show_default=True, help="Publish immediately.")
def publish_media(
    platform: str,
    media_path: str,
    text: str,
    title: str | None,
    topic: str,
    hashtags: tuple[str, ...],
    auto_approve: bool,
) -> None:
    """Publish an existing video without AI generation (YouTube, TikTok)."""
    pipeline = PostingPipeline(get_settings())
    result = pipeline.publish_existing(
        topic=topic,
        platform=platform,
        text=text,
        media_path=media_path,
        title=title,
        hashtags=list(hashtags),
        auto_publish=auto_approve,
    )
    _echo_result(result)


@cli.command()
def drafts() -> None:
    """List draft ids awaiting approval."""
    pipeline = PostingPipeline(get_settings())
    draft_ids = pipeline.drafts.list_drafts()
    if not draft_ids:
        click.echo("No pending drafts.")
        return
    for draft_id in draft_ids:
        try:
            content = pipeline.drafts.load(draft_id)
        except Exception as exc:  # noqa: BLE001
            click.echo(f"[{draft_id}] <unreadable draft: {exc}>", err=True)
            continue
        media_note = f" [media: {content.media_path}]" if content.media_path else ""
        click.echo(f"[{draft_id}] ({content.platform}) {content.text}{media_note}")


@cli.command()
@click.option("--draft-id", required=True, help="Draft id from `drafts`.")
def approve(draft_id: str) -> None:
    """Publish a previously generated draft."""
    pipeline = PostingPipeline(get_settings())
    result = pipeline.approve_draft(draft_id)
    _echo_result(result)


@cli.command()
def history() -> None:
    """Show the most recent post attempts."""
    pipeline = PostingPipeline(get_settings())
    for record in pipeline.history.recent():
        click.echo(f"[{record.status}] ({record.platform}) {record.text[:60]!r}")


@cli.command("schedule-once")
def schedule_once() -> None:
    """Run any due scheduled jobs once and exit (for cron / GitHub Actions)."""
    outcome = Scheduler().run_due_jobs()
    if outcome.succeeded:
        click.echo(f"Succeeded ({len(outcome.succeeded)}): {', '.join(outcome.succeeded)}")
    if outcome.skipped:
        click.echo(f"Skipped ({len(outcome.skipped)}): {', '.join(outcome.skipped)}")
    if outcome.failed:
        click.echo(f"Failed ({len(outcome.failed)}): {', '.join(outcome.failed)}", err=True)
        raise SystemExit(1)
    if not outcome.ran_any:
        click.echo("No jobs due.")


@cli.command()
@click.option("--tick-seconds", default=60, show_default=True, help="Polling interval for checking due jobs.")
def schedule(tick_seconds: int) -> None:
    """Run the scheduler loop, posting queued topics on their configured interval."""
    scheduler = Scheduler(tick_seconds=tick_seconds)
    scheduler.run_forever()


if __name__ == "__main__":
    cli()
