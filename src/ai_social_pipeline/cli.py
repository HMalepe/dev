"""Command-line interface for the pipeline.

Examples:
    python -m ai_social_pipeline generate --topic "AI in marketing" --platform twitter
    python -m ai_social_pipeline post --topic "AI in marketing" --platform mock --auto-approve
    python -m ai_social_pipeline drafts
    python -m ai_social_pipeline approve --draft-id 1730000000-abcd1234
    python -m ai_social_pipeline schedule
"""

from __future__ import annotations

import click

from .config import get_settings
from .pipeline import PostingPipeline
from .scheduler import Scheduler


@click.group()
def cli() -> None:
    """AI-powered social media automated posting pipeline."""


@cli.command()
@click.option("--topic", required=True, help="Subject to write about.")
@click.option("--platform", default="twitter", show_default=True, help="Target platform (twitter, linkedin, mock).")
@click.option("--tone", default="friendly", show_default=True, help="Tone of voice for the generated copy.")
@click.option("--hashtag", "hashtags", multiple=True, help="Hashtag to append (repeatable).")
def generate(topic: str, platform: str, tone: str, hashtags: tuple[str, ...]) -> None:
    """Generate content and print it, without saving or publishing."""
    pipeline = PostingPipeline(get_settings())
    content = pipeline.generate(topic=topic, platform=platform, tone=tone, hashtags=list(hashtags))
    click.echo(content.full_text)


@cli.command()
@click.option("--topic", required=True, help="Subject to write about.")
@click.option("--platform", default="twitter", show_default=True, help="Target platform (twitter, linkedin, mock).")
@click.option("--tone", default="friendly", show_default=True, help="Tone of voice for the generated copy.")
@click.option("--hashtag", "hashtags", multiple=True, help="Hashtag to append (repeatable).")
@click.option("--auto-approve/--no-auto-approve", default=None, help="Publish immediately instead of saving a draft.")
def post(topic: str, platform: str, tone: str, hashtags: tuple[str, ...], auto_approve: bool | None) -> None:
    """Generate content and either publish it or save it as a draft for review."""
    pipeline = PostingPipeline(get_settings())
    result = pipeline.run_once(
        topic=topic, platform=platform, tone=tone, hashtags=list(hashtags), auto_publish=auto_approve
    )

    if result.status == "posted":
        click.echo(f"Posted to {platform}. External id: {result.external_id}")
    elif result.status == "draft":
        click.echo(f"Saved as draft '{result.draft_id}'. Approve with: approve --draft-id {result.draft_id}")
    elif result.status == "skipped_duplicate":
        click.echo("Skipped: identical content was already posted before.")
    else:
        click.echo(f"Failed to post: {result.error}", err=True)
        raise SystemExit(1)


@cli.command()
def drafts() -> None:
    """List draft ids awaiting approval."""
    pipeline = PostingPipeline(get_settings())
    draft_ids = pipeline.drafts.list_drafts()
    if not draft_ids:
        click.echo("No pending drafts.")
        return
    for draft_id in draft_ids:
        content = pipeline.drafts.load(draft_id)
        click.echo(f"[{draft_id}] ({content.platform}) {content.text}")


@cli.command()
@click.option("--draft-id", required=True, help="Draft id from `drafts`.")
def approve(draft_id: str) -> None:
    """Publish a previously generated draft."""
    pipeline = PostingPipeline(get_settings())
    result = pipeline.approve_draft(draft_id)
    if result.status == "posted":
        click.echo(f"Posted. External id: {result.external_id}")
    else:
        click.echo(f"Failed to post: {result.error}", err=True)
        raise SystemExit(1)


@cli.command()
def history() -> None:
    """Show the most recent post attempts."""
    pipeline = PostingPipeline(get_settings())
    for record in pipeline.history.recent():
        click.echo(f"[{record.status}] ({record.platform}) {record.text[:60]!r}")


@cli.command()
@click.option("--tick-seconds", default=60, show_default=True, help="Polling interval for checking due jobs.")
def schedule(tick_seconds: int) -> None:
    """Run the scheduler loop, posting queued topics on their configured interval."""
    scheduler = Scheduler(tick_seconds=tick_seconds)
    scheduler.run_forever()


if __name__ == "__main__":
    cli()
