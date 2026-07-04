# My First AI Social Media Automated Posting Pipeline

A small, extensible Python pipeline that generates social media posts with
AI and publishes them automatically (or after human approval) to multiple
platforms.

```
generate  →  approve (optional)  →  publish  →  log / de-dup history
```

## Features

- **AI content generation** via OpenAI, with a deterministic **offline
  template fallback** so the whole pipeline works with zero API keys.
- **Pluggable platform adapters** (`twitter`, `linkedin`, `mock`) behind a
  single `Platform` interface — add a new one in a few lines.
- **Draft / approval workflow** — by default, generated posts are saved as
  drafts for review before anything is published. Flip `PIPELINE_AUTO_APPROVE=true`
  (or pass `--auto-approve`) to publish immediately.
- **De-duplication** — a SQLite history store fingerprints every post so the
  same content is never published twice.
- **Scheduling** — a lightweight polling scheduler posts topics from
  `data/content_queue.json` on a configurable interval per entry.
- **Dry-run by default** — `PIPELINE_DRY_RUN=true` (the default) simulates
  publishing so you can try the whole flow safely before wiring up real
  credentials.

## Project layout

```
src/ai_social_pipeline/
├── cli.py                 # `ai-social-pipeline` command line entry point
├── config.py               # Settings loaded from environment / .env
├── content_generator.py    # AI (or offline template) post generation
├── pipeline.py              # Orchestrates generate -> approve -> publish
├── scheduler.py             # Polling scheduler for queued recurring posts
├── storage.py               # SQLite history + JSON drafts/queue
└── platforms/
    ├── base.py              # Platform interface
    ├── mock.py              # No-op platform for testing/dry runs
    ├── twitter.py           # Twitter/X via tweepy
    └── linkedin.py          # LinkedIn via the UGC Posts REST API
tests/                       # pytest suite (fully offline, no network/creds)
data/content_queue.example.json  # Example scheduled-post queue
.env.example                 # All supported environment variables
```

## Getting started

```bash
# 1. Install the package with dev tooling
pip install -e ".[dev]"

# (optional extras, install what you plan to use)
pip install -e ".[openai,twitter,linkedin,scheduler]"
# or everything at once:
pip install -e ".[all]"

# 2. Configure environment variables (all optional for local testing)
cp .env.example .env

# 3. Generate a post (prints only, nothing saved)
python -m ai_social_pipeline generate --topic "AI in marketing" --platform twitter

# 4. Generate + save as a draft for review
python -m ai_social_pipeline post --topic "AI in marketing" --platform mock

# 5. List and approve pending drafts
python -m ai_social_pipeline drafts
python -m ai_social_pipeline approve --draft-id <draft-id-from-above>

# 6. Or skip the draft step and publish immediately
python -m ai_social_pipeline post --topic "AI in marketing" --platform mock --auto-approve

# 7. View recent post history
python -m ai_social_pipeline history

# 8. Run the scheduler against data/content_queue.json
cp data/content_queue.example.json data/content_queue.json
python -m ai_social_pipeline schedule
```

Everything above works out of the box with **no API keys**: content comes
from offline templates and `PIPELINE_DRY_RUN=true` simulates publishing.

## Going live

1. Add an `OPENAI_API_KEY` to `.env` to switch from offline templates to
   real AI-generated copy.
2. Add credentials for the platform(s) you want to post to (`TWITTER_*` or
   `LINKEDIN_*` in `.env.example`).
3. Set `PIPELINE_DRY_RUN=false` once you're ready for real posts to go out.
4. Decide on your approval model: keep `PIPELINE_AUTO_APPROVE=false` (default)
   to review every draft, or set it to `true` for a fully automated pipeline.

## Adding a new platform

Implement `Platform` in `src/ai_social_pipeline/platforms/` and register it
in `PLATFORM_REGISTRY` (`src/ai_social_pipeline/platforms/__init__.py`):

```python
class MyPlatform(Platform):
    name = "myplatform"

    def is_configured(self) -> bool:
        return bool(self._settings.my_platform_token)

    def publish(self, content: PostContent) -> PublishResult:
        ...
```

## Testing

```bash
pytest --cov=ai_social_pipeline --cov-report=term-missing
ruff check src tests
```

The test suite runs fully offline (no network calls, no credentials
required) using the `mock` platform and the offline content generator.

## Notes on this repository

This project was scaffolded as a starting point for building out a real
posting pipeline — the credential handling, retry/error handling per
platform, and scheduling cadence should be reviewed and hardened before
running unattended against real social accounts.
