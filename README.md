# My First AI Social Media Automated Posting Pipeline

A small, extensible Python pipeline that generates social media posts with AI and publishes them automatically (or after human approval) to **X/Twitter, LinkedIn, YouTube, and TikTok**.

```
generate  →  approve (optional)  →  publish  →  log / de-dup history
```

## Features

- **AI content generation** via OpenAI, with a deterministic **offline template fallback** so the whole pipeline works with zero API keys.
- **Pluggable platform adapters** (`twitter`, `linkedin`, `youtube`, `tiktok`, `mock`) behind a single `Platform` interface.
- **Video upload support** — attach `--media` for YouTube Shorts, TikTok, or images on X.
- **Draft / approval workflow** — by default, generated posts are saved as drafts for review. Flip `PIPELINE_AUTO_APPROVE=true` (or pass `--auto-approve`) to publish immediately.
- **De-duplication** — a SQLite history store fingerprints every post so the same content is never published twice.
- **Scheduling** — a lightweight polling scheduler posts topics from `data/content_queue.json` on a configurable interval per entry.
- **Free GitHub Actions cron** — run `schedule-once` daily with zero hosting cost.
- **Dry-run by default** — `PIPELINE_DRY_RUN=true` (the default) simulates publishing so you can try the whole flow safely before wiring up real credentials.

## Supported platforms

| Platform | Text posts | Video upload | API |
|----------|------------|--------------|-----|
| **X / Twitter** | ✅ | Images | Official (tweepy) |
| **LinkedIn** | ✅ | — | Official REST API |
| **YouTube** | — | ✅ Shorts/videos | Official Data API v3 |
| **TikTok** | — | ✅ | Official Content Posting API |

## Project layout

```
src/ai_social_pipeline/
├── cli.py                 # `ai-social-pipeline` command line entry point
├── config.py              # Settings loaded from environment / .env
├── content_generator.py   # AI (or offline template) post generation
├── pipeline.py            # Orchestrates generate -> approve -> publish
├── scheduler.py           # Polling scheduler + persisted state for cron
├── storage.py             # SQLite history + JSON drafts/queue
└── platforms/
    ├── base.py            # Platform interface
    ├── media.py           # Media file validation helpers
    ├── mock.py            # No-op platform for testing/dry runs
    ├── twitter.py         # Twitter/X via tweepy (+ image upload)
    ├── linkedin.py        # LinkedIn via the UGC Posts REST API
    ├── youtube.py         # YouTube via resumable upload (requests only)
    └── tiktok.py          # TikTok via Content Posting API
tests/                     # pytest suite (fully offline, no network/creds)
data/content_queue.example.json
.github/workflows/scheduled-posting.yml  # Free daily cron
.env.example
```

## Getting started

```bash
# 1. Install the package with dev tooling
pip install -e ".[dev]"

# Optional integrations — install what you plan to use
pip install -e ".[openai,twitter,linkedin,youtube,tiktok]"
# or everything at once:
pip install -e ".[all]"

# 2. Configure environment variables (all optional for local testing)
cp .env.example .env

# 3. Generate a post (prints only, nothing saved)
python -m ai_social_pipeline generate --topic "AI in marketing" --platform twitter

# 4. Generate + save as a draft for review
python -m ai_social_pipeline post --topic "AI in marketing" --platform mock

# 5. Post a video to YouTube or TikTok (dry-run by default)
python -m ai_social_pipeline publish-media --platform youtube --media clip.mp4 --text "Weekly update #Shorts" --title "Week 1"

# 6. List and approve pending drafts
python -m ai_social_pipeline drafts
python -m ai_social_pipeline approve --draft-id <draft-id-from-above>

# 7. Or skip the draft step and publish immediately
python -m ai_social_pipeline post --topic "AI in marketing" --platform mock --auto-approve

# 8. View recent post history
python -m ai_social_pipeline history

# 9. Run scheduled posts once (for cron / GitHub Actions)
cp data/content_queue.example.json data/content_queue.json
python -m ai_social_pipeline schedule-once

# 10. Or run the local scheduler loop continuously
python -m ai_social_pipeline schedule
```

Everything above works out of the box with **no API keys**: content comes from offline templates and `PIPELINE_DRY_RUN=true` simulates publishing.

## Going live

1. Add an `OPENAI_API_KEY` to `.env` to switch from offline templates to real AI-generated copy.
2. Add credentials for the platform(s) you want to post to (see `.env.example`).
3. Set `PIPELINE_DRY_RUN=false` once you're ready for real posts to go out.
4. Decide on your approval model: keep `PIPELINE_AUTO_APPROVE=false` (default) to review every draft, or set it to `true` for a fully automated pipeline.

### Platform setup (cheapest path — official APIs, $0 hosting)

| Platform | What you need |
|----------|----------------|
| **X / Twitter** | Developer app + `TWITTER_*` keys in `.env` |
| **LinkedIn** | OAuth token + author URN |
| **YouTube** | Google Cloud project → YouTube Data API v3 → OAuth refresh token (`YOUTUBE_*`) |
| **TikTok** | TikTok Developer app → Content Posting API → `TIKTOK_ACCESS_TOKEN` |

## Free scheduled posting (GitHub Actions)

1. Push this repo to GitHub.
2. Add secrets in **Settings → Secrets and variables → Actions** (see `.env.example`).
3. Copy `data/content_queue.example.json` to `data/content_queue.json` and customize.
   - Each entry should have a stable `job_id` (included in the example).
   - For video posts, see `data/content_queue.video.example.json`.
4. The workflow in `.github/workflows/scheduled-posting.yml` runs daily at 09:00 UTC.

**Safe defaults:** scheduled runs use `PIPELINE_DRY_RUN=true` and `PIPELINE_AUTO_APPROVE=false` unless you override repository variables. Scheduler state and post history are cached between runs so `interval_minutes` is honored.

To test manually: **Actions → Scheduled posting → Run workflow** (dry-run defaults to on).

Set repository variable `PIPELINE_DRY_RUN=false` only when you're ready to post for real.

## Adding a new platform

Implement `Platform` in `src/ai_social_pipeline/platforms/` and register it in `PLATFORM_REGISTRY` (`src/ai_social_pipeline/platforms/__init__.py`):

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
pytest
ruff check src tests
```

The test suite runs fully offline (no network calls, no credentials required) using the `mock` platform and the offline content generator.

## Notes

This project is designed as a **cheap, lightweight** alternative to heavy self-hosted suites (Postiz, OpenBuzz, etc.). Run it locally or on GitHub Actions for **$0 hosting**. Review credential handling and retry logic before running unattended against real social accounts.
