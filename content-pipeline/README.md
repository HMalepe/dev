# Content Pipeline

The SA/African true crime AI content pipeline. Single user, forever — no
teams, roles, or multi-tenant anything.

- **Phase 0** (infrastructure): a deployed, authenticated empty shell —
  no agent logic, no content generation, no publishing code.
- **Phase 1** (brand voice & QA rubric): the persona spec and a QA agent
  that scores drafts against it, calibrated against known-good/known-bad
  scripts before it's trusted with anything real. Still no draft/research/
  publish agents, and QA itself is not yet wired into any live route.
- **Phase 2** (core pipeline agents): live Research, Draft, and QA agents
  (`app/api/agents/*`) that call the Claude API, chain internally
  (Research → Draft → QA), and log every call to `agent_logs`. A single
  `run-pipeline` trigger takes a content item from nothing to
  `qa_passed`/`qa_rejected`. No asset generation or publishing yet.
- **Phase 3** (asset pipeline): takes an approved (`scheduled`) content item
  and produces a finished long-form video, a vertical short with burned-in
  captions, and a thumbnail — narration via ElevenLabs, assembly via
  Shotstack (submit-then-poll-via-cron, never synchronous), optional
  non-identifying B-roll via Kling, generic imagery via Pexels, automated
  QA on every output, landing at `stage = 'assets_generated'`. **Corrected
  in Phase 7** to trigger on `stage = 'scheduled'` (i.e. after human
  review) instead of `stage = 'qa_passed'` (immediately, before review) —
  see "Phase 3/4/5 sequencing fix" under Phase 7 below. No platform
  publishing (Phase 5) or dashboard review UI (Phase 7) yet.
- **Phase 4** (feedback loop): captures manual (human) rejections with the
  same rigor QA-agent rejections already get, builds a rolling "recently
  rejected, avoid these patterns" block injected into the Draft agent's
  system prompt (with Anthropic prompt caching on both that block and the
  rubric), and a weekly cron snapshot (`weekly_reviews`) tracking whether
  QA pass rate is actually improving. No review-queue UI (Phase 7) — this
  phase only builds the capture/feedback logic that UI will call into.
- **Phase 5** (platform publishing): three independent publish agents
  (YouTube, Instagram, TikTok) plus a 15-minute scheduler that respects
  each platform's own rate limit, writes results to `platform_posts`, and
  advances `content_items.stage` to `'published'` once every platform has
  reached a terminal state (`posted`/`ready`/`failed`) — not just the
  first to succeed. No further asset generation, no dashboard scheduling
  calendar (Phase 7).
- **Phase 7** (dashboard): the three UI views this pipeline was missing —
  a review queue (`/dashboard/review`), a scheduling calendar
  (`/dashboard/calendar`), and an analytics view (`/dashboard/analytics`)
  — plus a fix to a sequencing gap between Phase 3 and Phase 4/5 that had
  to land before the review queue could mean anything: Phase 3's asset
  pipeline now fires on `stage = 'scheduled'` (set by this phase's
  approve action) instead of `stage = 'qa_passed'` (i.e. instantly, before
  any human ever reviewed the script). Hand-rolled SVG charts, no charting
  library dependency. Still one user, no role management.

## Stack

- **Framework:** Next.js (App Router, TypeScript strict mode)
- **Styling:** Tailwind CSS
- **Backend/DB:** Supabase (Postgres + Auth)
- **Hosting:** Vercel

## What exists today

### Phase 0 — infrastructure shell

- `app/login/page.tsx` — email/password sign-in (no signup form; see below)
- `app/dashboard/page.tsx` — bare authenticated placeholder
- `proxy.ts` + `lib/supabase/middleware.ts` — redirects unauthenticated
  requests to `/login` on every route (this is Next.js 16's renamed
  `middleware.ts` convention — see [Deviations from the task brief](#deviations-from-the-task-brief) below)
- `lib/supabase/client.ts` / `lib/supabase/server.ts` — `@supabase/ssr`
  browser/server clients, plus a service-role client for privileged
  server-only operations
- `supabase/migrations/0001_init.sql` — `content_items`, `platform_posts`,
  `agent_logs` tables with RLS enabled and a single "authenticated users can
  do everything" policy on each

### Phase 1 — brand voice & QA rubric

- `docs/brand-voice-qa-rubric.md` — the channel's persona spec, tone
  pillars, banned content/phrases, structural template, and QA scoring
  rubric. Source of truth for everything below.
- `lib/agents/qa/` — a standalone QA agent (`runQaCheck(scriptText)`) that
  scores a script draft against the rubric via the Claude API and returns a
  PASS/FAIL verdict with a per-axis score and reason. **Not called from any
  route or Server Action yet** — see the calibration step below.
- `qa-calibration/` — 10 compliant + 10 non-compliant fictional calibration
  scripts with a `manifest.json` of expected verdicts, plus
  `npm run qa:calibrate` to run them all through the real QA agent and
  confirm the rubric discriminates before it's ever wired into the live
  pipeline. Requires `ANTHROPIC_API_KEY`.

### Phase 2 — Research, Draft, and QA agents

- `lib/anthropic.ts` — the shared Anthropic client + the `MODELS` map
  (`SONNET` = `claude-sonnet-5`, `HAIKU` = `claude-haiku-4-5-20251001`).
  Model routing between the two is a deliberate cost decision — Sonnet for
  open-ended research/writing, Haiku for fixed-rubric QA scoring — and is
  never swapped.
- `lib/logAgentCall.ts` — wraps every Anthropic call: computes `cost_usd`
  from hardcoded per-million-token pricing and writes one row to
  `agent_logs` per call, success or failure. **Pricing is hardcoded as of
  this build (Sonnet 5 $2/$10 introductory rate through Aug 31 2026, Haiku
  4.5 $1/$5) — flag to the user if it needs updating, don't silently
  guess.**
- `lib/rubric.ts` — the Phase 1 rubric hardcoded as a `RUBRIC_TEXT` string
  (for the Draft agent's system prompt) and a structured `QA_AXES` array
  (for the QA agent's system prompt). A separate, purpose-built copy from
  `lib/agents/qa/` (the Phase 1 calibration module) — see
  [Deviations from the task brief](#deviations-from-the-task-brief).
- `lib/agents/pipeline/research.ts` — `runResearchAgent(seedTopic?,
  seedRegion?)`. Calls Sonnet with the `web_search_20250305` server tool,
  parses the JSON case brief, inserts a new `content_items` row at
  `stage = 'researched'`, then immediately calls the Draft agent in-process.
- `lib/agents/pipeline/draft.ts` — `runDraftAgent(contentItemId, brief)`.
  Calls Sonnet with the rubric embedded in the system prompt, parses the
  script + platform variants, updates the row to `stage = 'scripted'`, then
  immediately calls the QA agent in-process.
- `lib/agents/pipeline/qa.ts` — `runQaAgent(contentItemId)`. Calls Haiku to
  score the script against `QA_AXES`, updates `qa_score`, `qa_result`,
  `rejection_reason`, and `stage` (`qa_passed`/`qa_rejected`).
- `app/api/agents/research/route.ts`, `.../draft/route.ts`,
  `.../qa/route.ts` — thin HTTP wrappers around the three functions above,
  for standalone/manual re-triggering of a single stage.
- `app/api/agents/run-pipeline/route.ts` — the one endpoint the dashboard
  button (and, later, Phase 7) calls: triggers Research and returns the
  final `content_items` row once the internal chain settles.
- `app/dashboard/run-pipeline-button.tsx` — the "bare trigger button" the
  Phase 2 brief calls for: fires `run-pipeline` and shows the resulting
  `stage` / `qa_result` / `rejection_reason`. Not the real review queue —
  that's Phase 7.

**Error handling:** every Anthropic call is wrapped in try/catch; every
failure (API error or unparseable JSON) is logged to `agent_logs` with
`status: 'fail'` before the error propagates. There is no retry/backoff —
if an agent fails, the `content_items` row simply stays at its last
successful `stage`, and `agent_logs` (plus the row's own `stage`) is how a
human notices the item wasn't fully processed. This is a deliberate
Phase 2 scope boundary, not an oversight (see the brief's own "no
automatic retry" constraint).

### Phase 3 — asset pipeline

- `lib/integrations/` — thin wrappers around the four external APIs, each
  hitting the real documented endpoint (verified against each provider's
  own API reference, not guessed):
  - `elevenlabs.ts` — `POST /v1/text-to-speech/{voice_id}` with a calm/
    measured `voice_settings` preset (high stability, low style, no
    speaker-boost theatrics).
  - `shotstack.ts` — `POST/GET /edit/{stage}/render`. `SHOTSTACK_STAGE`
    controls `v1` (production, billed, **no watermark**) vs. `stage`
    (free sandbox, **watermarked**) — this is also how the asset QA step's
    watermark check works, see below.
  - `pexels.ts` — `GET /v1/search`, one landscape photo per call.
  - `kling.ts` — see "Deviations" below for why this targets fal.ai's
    hosted Kling endpoint specifically, and why it's off by default.
  - `ffprobe.ts` — best-effort only; see "Deviations".
- `lib/agents/pipeline/assets/beats.ts` — splits `script_text` into the 6
  Phase 1 structural beats. Paragraph-count-6 is the clean case; otherwise
  falls back to a proportional sentence-level split against each beat's
  target share of runtime. This is a heuristic by necessity — see
  "Deviations".
- `lib/agents/pipeline/assets/voiceover.ts` — `runVoiceoverAgent`. Fetches
  `script_text`, calls ElevenLabs, uploads the mp3 to the `voiceover-audio`
  Supabase Storage bucket (created automatically on first use), updates
  `asset_urls.voiceover_url`, logs cost (character-count-based), then
  chains into the assemble agent.
- `lib/agents/pipeline/assets/assemble.ts` — `runAssembleAgent`. Estimates
  narration duration (ffprobe on the voiceover file if available, else a
  words-per-minute estimate), splits into beats, sources one Pexels image
  per beat, optionally submits up to 3 Kling B-roll jobs for the
  hook/mechanism/unraveling beats (`ENABLE_KLING_BROLL`, off by default),
  and either submits the main Shotstack render immediately (no Kling
  pending) or leaves it for the cron job to submit once all Kling jobs
  resolve — this keeps *every* async step on the submit-then-poll-via-cron
  pattern, no exceptions, including the optional B-roll path.
- `lib/agents/pipeline/assets/shotstackTimeline.ts` — builds the Shotstack
  JSON timeline: Ken Burns `zoomIn`/`zoomOut` on static images (Shotstack's
  own built-in effect, alternated per beat), crossfade transitions between
  beats, a `soundtrack` synced to the full voiceover for the main video,
  and an aliased narration clip + auto-transcribed `caption` track for the
  vertical cut.
- `lib/agents/pipeline/assets/vertical.ts` — `generateVerticalAndThumbnail`,
  called by the cron job once the main render is `done`. Picks the
  strongest 30-60s beat (mechanism preferred, then hook, then unraveling,
  per the brief's own suggestion), submits it as a second Shotstack render
  at 1080x1920 with burned-in captions, and generates the thumbnail
  synchronously via `sharp` (an SVG text overlay of the hook line
  composited onto the hook beat's image) rather than a third Shotstack
  round-trip, per the brief's "don't overbuild this part".
- `lib/agents/pipeline/assets/cron.ts` — `checkPendingRenders`, the core
  logic behind the cron route. Queries `stage = 'scheduled'` (**changed in
  Phase 7** from `stage = 'qa_passed'` — see "Phase 7" below for why).
  Per content item, per tick: kick off voiceover if nothing's started yet
  (Phase 7's safety net for a missed direct trigger on approve) → resolve
  any pending Kling jobs → submit the main render once they're all
  resolved → poll the main render → poll the vertical render → run asset
  QA once all three asset URLs exist. Downloads finished renders from
  Shotstack's temporary URL and re-uploads to the `rendered-videos`
  Supabase Storage bucket ("don't leave production assets solely
  dependent on a third-party CDN link"). A `failed` render leaves `stage`
  untouched so it surfaces as stuck rather than disappearing.
- `lib/agents/pipeline/assets/qa.ts` — `runAssetQaCheck`. Resolution and
  watermark checks are deterministic (by construction / by Shotstack
  stage, see above) rather than re-inspected after the fact; duration
  checks use Shotstack's own reported `duration`; ffprobe is layered on
  top as an optional, non-blocking cross-check. On pass: `asset_urls.
  qa_passed = true` and `stage = 'assets_generated'`. On fail: the specific
  reason is logged and written to `asset_urls.qa_failure_reason`, and
  `stage` is left unchanged.
- `app/api/agents/asset/voiceover/route.ts` — the pipeline's entry point:
  `{ contentItemId }` → voiceover → assemble, mirroring Phase 2's
  research → draft → qa internal-chaining pattern. As of Phase 7, this is
  also called directly (not just manually) by the approve endpoint the
  instant a human approves a script — see "Phase 7" below.
- `app/api/agents/asset/assemble/route.ts` — standalone re-trigger for the
  assemble step alone (e.g. to retry image sourcing/render submission
  without paying for another ElevenLabs call).
- `app/api/cron/check-renders/route.ts` + `vercel.json` — the render-status
  poller, run every 2 minutes. Secured with a `CRON_SECRET` bearer token
  (Vercel sends this automatically) and exempted from the Supabase-session
  auth proxy in `lib/supabase/middleware.ts`, since Vercel's cron invoker
  has no user session.

**Error handling:** every non-Anthropic external call (ElevenLabs,
Shotstack, Kling, Pexels) is logged to `agent_logs` with a real,
non-null `cost_usd` — computed immediately when the cost is known
synchronously (ElevenLabs' character count, Pexels' flat $0 free tier), or
logged by the cron job once an async job resolves and its true billable
duration/seconds is known (Shotstack renders, Kling clips), rather than
guessed at submission time. A failed submission that was never billed is
logged with `cost_usd: 0` — a real number, not a null placeholder.

### Phase 4 — feedback loop

- `supabase/migrations/0002_feedback_loop.sql` — adds `content_items.
  rejected_by` (`'qa_agent' | 'human'`), the `weekly_reviews` table (RLS +
  "authenticated full access" policy, same pattern as every other table),
  a `content_items_set_updated_at` trigger (see "Deviations" — this fixes a
  real Phase 0 gap that Phase 4 is the first phase to actually depend on),
  and extends `agent_logs.agent_name`'s check constraint to allow
  `'weekly_review'`.
- `app/api/content-items/[id]/reject/route.ts` — `POST { reason: string }`.
  Sets `stage = 'qa_rejected'`, `rejected_by = 'human'`,
  `rejection_reason = reason`. `reason` is validated as required and
  non-empty (400 if missing/blank/whitespace-only) — no silent, reason-less
  rejections, per the brief's own explicit constraint. Also guards that the
  item is actually at a stage that means "already passed automated QA"
  (`qa_passed`, `scheduled`, or `assets_generated` — `scheduled` added in
  Phase 7, once that stage started meaning something) before allowing the
  transition (409 otherwise) — see "Deviations".
- `app/api/content-items/[id]/approve/route.ts` — companion endpoint,
  `POST` with an optional `{ scheduledAt?: string }` body (ISO timestamp;
  defaults to "now"). **This endpoint's behavior changed twice across
  phases — see "Phase 7 — Phase 3/4/5 sequencing fix" below for the full,
  final story and why**: it now sets both `scheduled_at` and
  `stage = 'scheduled'`, and directly kicks off the Phase 3 asset
  pipeline. Only allows the transition from `stage = 'qa_passed'` (409
  otherwise, tightened in Phase 7 from also allowing `assets_generated`).
  Doesn't touch `rejected_by`/`rejection_reason` — it doesn't generate
  feedback-loop data itself, per the brief.
- `lib/getRecentRejections.ts` — `getRecentRejectionsContext()`. Queries
  the 15 most recently updated `content_items` with a non-null
  `rejection_reason` (from either rejection source — see "Deviations" for
  why the query differs slightly from the brief's literal sample), and
  formats each as `[qa_agent]`/`[human]`-tagged lines so the two sources
  stay visually distinct in the block itself, not just in the underlying
  data.
- `lib/agents/pipeline/draft.ts` — now builds `system` as an array of two
  cached text blocks: the existing rubric-embedding system prompt (cached —
  "almost never changes"), then `getRecentRejectionsContext()`'s output
  when non-empty (cached separately — "changes daily-ish"). Both use
  `cache_control: { type: 'ephemeral' }`. Every `logAgentCall` from the
  Draft agent now also records `cache_creation_input_tokens`/
  `cache_read_input_tokens` from `response.usage` in its `outputSummary`,
  so cache activity is checkable straight from `agent_logs` (see Definition
  of Done below for why that check matters).
- `lib/logAgentCall.ts` — `PRICING` now includes `cacheWrite`/`cacheRead`
  per-million-token rates per model, and the token-based cost calculation
  adds `cacheCreationInputTokens`/`cacheReadInputTokens` (both optional,
  additive with the existing `inputTokens`/`outputTokens`) at those rates.
  Sonnet 5's `cacheRead` rate ($0.30/M) is the exact figure given in the
  Phase 4 brief; `cacheWrite` isn't specified there, so it's set at
  Anthropic's standard 5-minute-cache-write multiplier (1.25x base input) —
  flag if that convention doesn't hold for these specific models.
- `lib/agents/pipeline/qa.ts` — now also sets `rejected_by = 'qa_agent'`
  whenever `overall_result = 'fail'`, and clears it back to `null` on a
  pass (so a later re-run that succeeds doesn't leave a stale rejection
  source pointing at a previous draft).
- `lib/agents/pipeline/weeklyReview.ts` — `runWeeklyReview()`. Queries
  `content_items` touched in the trailing 7 days (by `updated_at`),
  computes `items_processed`, `qa_pass_rate`, and `human_approval_rate`
  (see "Deviations" for the exact denominators used), fetches the prior
  `weekly_reviews` row for `prior_week_qa_pass_rate`, sends every
  `rejection_reason` from the week to Haiku for theme clustering (skipped
  entirely, with `top_rejection_themes: []`, if there were none — no need
  to pay for an LLM call on empty input), logs that Haiku call to
  `agent_logs` (`agentName: 'weekly_review'`), and inserts one
  `weekly_reviews` row.
- `app/api/cron/weekly-review/route.ts` + `vercel.json`'s
  `0 6 * * 1` entry (Monday 6am UTC — adjust if you need a different
  timezone) — same `CRON_SECRET` bearer-token auth pattern as
  `check-renders`, and exempted from the Supabase-session auth proxy the
  same way (the existing `/api/cron/*` prefix check in
  `lib/supabase/middleware.ts` already covers this route, no changes
  needed there).

### Phase 5 — platform publishing

- `supabase/migrations/0003_platform_publishing.sql` — adds the
  `platform_tokens` table (`platform`, `access_token`, `refresh_token`,
  `expires_at`), reusing 0002's `set_updated_at()` trigger, and a
  `platform_posts.provider_job_id` column (see "Deviations" for why this
  is needed beyond the brief's literal schema).
- `lib/integrations/youtube.ts` — `uploadVideoToYoutube`. Uses the
  official `googleapis` client (added as a dependency) rather than
  hand-rolled multipart/resumable HTTP, for the same reason
  `@anthropic-ai/sdk` is used elsewhere instead of raw fetch — resumable
  upload semantics are easy to get subtly wrong by hand. Sets
  `status.publishAt` + `privacyStatus: 'private'` when `scheduled_at` is
  in the future, `privacyStatus: 'public'` otherwise, exactly per the
  brief.
- `lib/integrations/instagram.ts` — `createReelContainer`,
  `getContainerStatus`, `publishContainer` (Meta's three-step Reels
  publish flow), and `exchangeForLongLivedToken` (the weekly refresh
  cron's core call). Hits `graph.facebook.com` (not the newer
  `graph.instagram.com` "Instagram API with Instagram Login" product),
  matching the brief's own OAuth setup description (Facebook Page-linked
  Business/Creator account, Facebook Login flow).
- `lib/integrations/tiktok.ts` — `refreshTiktokAccessToken`,
  `queryCreatorInfo`, `initVideoPublish` (via `PULL_FROM_URL`, since our
  videos already live at a public Supabase Storage URL), and
  `fetchPublishStatus`.
- `lib/platformTokens.ts` — `getPlatformToken`/`setPlatformToken`.
  Bootstraps `platform_tokens` from the one-time OAuth consent flow's seed
  env vars (`INSTAGRAM_ACCESS_TOKEN`, `TIKTOK_ACCESS_TOKEN`/
  `TIKTOK_REFRESH_TOKEN`) on first use; after that, the table (kept fresh
  by the two refresh crons below) is the sole source of truth and the env
  vars are never read again.
- `lib/agents/pipeline/publish/shared.ts` — `getOrCreatePlatformPost`,
  `updatePlatformPost`, `isRateLimited` (the brief's own rolling-24h-window
  rate-limit check, generalized across Instagram and TikTok instead of
  duplicated per platform), and `getContentItemForPublish`.
- `lib/agents/pipeline/publish/youtube.ts` — `runYoutubePublishAgent`.
  Single-shot: downloads `asset_urls.main_video_url`, uploads it, and
  either succeeds or fails on one attempt (no async job to poll, unlike
  Instagram/TikTok). Logs `cost_usd: 0` (never `null`) per the brief.
- `lib/agents/pipeline/publish/instagram.ts` — `runInstagramPublishAgent`.
  Checks the rolling 25/24hr limit *before* attempting a post; submits a
  Reels container using `asset_urls.vertical_video_url` (see "Deviations"
  for why the vertical cut, not the main video); a later call/tick resumes
  polling an already-submitted container (via `provider_job_id`) rather
  than submitting a duplicate, and only calls `media_publish` once
  `status_code = FINISHED`.
- `lib/agents/pipeline/publish/tiktok.ts` — `runTiktokPublishAgent`.
  Branches its entire behavior on `TIKTOK_AUDITED`: `false` sets
  `status = 'ready'` immediately (logged as `success`, per the brief —
  correctly deferring to manual posting is not a failure) and never calls
  the API at all; `true` checks the conservative 15/24hr limit, queries
  `creator_info` fresh before every post (never cached), and follows the
  same submit-then-resume-polling pattern as Instagram.
- `lib/agents/pipeline/publish/scheduler.ts` — `runPublishScheduler`, the
  `publish-scheduled` cron's core logic. Queries `content_items` at
  `stage = 'assets_generated'` with `scheduled_at <= now()`, attempts all
  three platforms independently per item (one platform's failure/rate
  limit never blocks the others), and only advances `stage = 'published'`
  once every `platform_posts` row for that item is in a terminal state.
- `app/api/agents/publish/{youtube,instagram,tiktok}/route.ts` — thin
  standalone wrappers for manually re-triggering a single platform's agent
  on one `content_item`, mirroring Phase 2/3's route pattern.
- `app/api/cron/publish-scheduled/route.ts` + `vercel.json`'s
  `*/15 * * * *` entry — the scheduler above, `CRON_SECRET`-gated like
  every other cron route.
- `app/api/cron/refresh-ig-token/route.ts` + `vercel.json`'s weekly entry
  — exchanges the current Instagram token for a fresh 60-day one via
  `fb_exchange_token`, unconditionally on schedule (not gated on
  `expires_at` — a weekly cadence against a 60-day token has enormous
  margin either way).
- `app/api/cron/refresh-tiktok-token/route.ts` + `vercel.json`'s daily
  entry — refreshes the TikTok access token, always persisting whatever
  `refresh_token` TikTok returns (TikTok rotates it on every use).

### Phase 7 — dashboard

#### Phase 3/4/5 sequencing fix (read this first)

Phase 3 was originally specced to fire the instant `stage = 'qa_passed'`
was reached — i.e. immediately after the QA agent scored a script, before
any human ever saw it. Phase 4's `approve` endpoint, meanwhile, went
through two different behaviors of its own (see the approve endpoint's
own file history/comment): first `stage = 'scheduled'` (a stage nothing
downstream actually watched for), then just `scheduled_at` (once Phase
5's publish scheduler's real query — `stage = 'assets_generated' AND
scheduled_at <= now()` — was known). Neither of those fixes addressed the
actual bug: **assets were being generated automatically the moment QA
passed, before a human ever got a chance to review the script** — which
defeats the entire purpose of a review queue (money gets spent on video/
audio generation before, not after, a human decides the script is worth
that spend).

Phase 7 fixes this at the root, per its own brief's section 0. Final,
correct sequencing:

1. QA agent passes an item → `stage = 'qa_passed'` (script only, no
   assets yet — this is what shows up in the review queue)
2. A human reviews and approves via `/dashboard/review` → the approve
   endpoint sets `scheduled_at` **and** `stage = 'scheduled'`, and
   immediately calls `runVoiceoverAgent` itself (not waiting for a
   polling cron to notice)
3. `lib/agents/pipeline/assets/cron.ts` now queries `stage = 'scheduled'`
   (changed from `'qa_passed'`) and includes a safety-net branch: any
   `'scheduled'` item with no `voiceover_url` and no `beat_plan` yet gets
   `runVoiceoverAgent` called on it, in case the approve endpoint's direct
   call failed or the request got interrupted. `runVoiceoverAgent` itself
   is now idempotent (checks `asset_urls.voiceover_url` first and no-ops
   if already set), so these two trigger paths can never double-generate
   a voiceover.
4. Assets complete → `stage = 'assets_generated'` (Phase 3's existing
   `runAssetQaCheck` logic, completely unchanged)
5. Phase 5's `publish-scheduled` cron picks up `assets_generated` items
   where `scheduled_at <= now()` and publishes (unchanged — this part was
   already correct, and always has been, since Phase 5)

No new migration was needed — `'scheduled'` has been a valid
`content_items.stage` enum value since `0001_init.sql`, it just wasn't
being written or watched for by anything until now.

#### What's new/changed

- `app/api/content-items/[id]/approve/route.ts` — see above. Also
  tightened `approvableStages` to `['qa_passed']` only (previously also
  allowed `assets_generated`, which no longer makes sense: under the
  corrected sequencing, `assets_generated` is always downstream of a
  `scheduled` item that's already been approved once — approving it again
  would re-trigger asset generation on an item that may already have, or
  be generating, assets).
- `app/api/content-items/[id]/reject/route.ts` — `rejectableStages` now
  also includes `scheduled` (a human might approve, then notice a problem
  before assets finish, and want to pull it back before more money is
  spent generating video/audio for it).
- `lib/agents/pipeline/assets/voiceover.ts` — idempotency guard (see
  above).
- `lib/agents/pipeline/assets/cron.ts` — stage query + safety-net kickoff
  branch (see above).
- `lib/agents/pipeline/publish/{instagram,tiktok}.ts` — `RATE_LIMIT_CEILING`
  exported (was module-private) so the calendar's rate-limit headroom
  indicator reads the exact same enforced number, never a separately
  hardcoded copy that could drift.
- `app/api/content-items/[id]/route.ts` — new `PATCH` endpoint. Partial
  update of `scriptText`/`platformVariants` (merges onto the existing
  `platform_variants` jsonb rather than replacing it wholesale), restricted
  to `stage = 'qa_passed'` items (409 otherwise — editing after approval
  would desync the script from whatever's already been voiced over or
  rendered). This is what the review queue's inline editing saves through,
  right before an approve/reject call, per the brief ("saved via PATCH
  before approve/reject, not a separate 'edit mode'").
- `app/dashboard/layout.tsx` — new shared nav shell (Home / Review Queue /
  Calendar / Analytics / sign out) wrapping every `/dashboard/*` route.
  Didn't exist before Phase 7; `app/dashboard/page.tsx` is unchanged and
  now just renders inside it.
- `app/dashboard/review/page.tsx` + `review-card.tsx` — the review queue.
  Server Component fetches `content_items` at `stage = 'qa_passed'`
  oldest-first (direct session-aware Supabase query, no new API route
  needed for the read side); each row renders as a `ReviewCard` Client
  Component with always-editable `script_text`/platform-variant textareas
  (no separate edit mode), a read-only QA score breakdown, clickable
  source links, a `scheduled_at` datetime picker, and Approve/Reject
  actions that `PATCH` first if anything was edited, then call the
  existing approve/reject endpoints.
- `app/dashboard/calendar/page.tsx` + `post-card.tsx` — the scheduling
  calendar. A plain 7-column CSS grid (Monday-start week, navigable via
  `?week=YYYY-MM-DD`), no calendar library. Fetches `platform_posts`
  joined to `content_items` for a generous window around the visible
  week and buckets rows into day columns in memory (by `posted_at` if
  posted, else the parent `scheduled_at`) rather than expressing an
  OR-across-a-join filter in supabase-js — simple, and more than fast
  enough at this pipeline's volume. Each day shows a rate-limit headroom
  line per platform (`YT: n/100 used`, etc. — Instagram/TikTok read the
  real enforced ceilings from `lib/platformCaps.ts`; YouTube's is
  display-only, since nothing in this codebase enforces a YouTube quota
  check, per Phase 5's own reasoning that it won't bind at any realistic
  volume). Cards are color-coded by platform (red/pink/black-ish per the
  brief) and additionally use border style (solid/dashed/dotted) +
  opacity for status, so status is never color-only information.
- `app/dashboard/analytics/page.tsx` + `charts.tsx` — the analytics view.
  Hand-rolled SVG `LineChart`/`BarChart` components (no charting library,
  per the brief's own constraint). Three sections: `weekly_reviews`'
  `qa_pass_rate`/`human_approval_rate` trend line; `agent_logs`' real
  cost-per-content-item (summed per `content_item_id`, then averaged
  across every item with at least one costed log row — deliberately not
  restricted to `stage = 'published'` items only, since that would
  silently exclude the real, sunk cost of every rejected/failed attempt
  along the way) plus a cost breakdown bar chart by `agent_name`; and
  `platform_posts`' posts-by-platform bar chart plus a called-out
  `status = 'failed'` count, both for the same `?week=` range as the
  calendar. Every section handles its own empty/error state independently
  (a fresh install renders three "nothing here yet" messages, not a
  crash; a Supabase query error surfaces its own message without taking
  down the other two sections).
- `lib/dateRange.ts` — Monday-start week math shared by the calendar and
  analytics pages (both default to "current week, navigable", and
  analytics' platform-posts chart explicitly uses "the same date range as
  the calendar view" per the brief).
- `lib/platformCaps.ts` — the known per-platform daily caps, labels, and
  colors used by the calendar (and re-exports Instagram/TikTok's real
  enforced `RATE_LIMIT_CEILING` rather than duplicating those numbers).

## One-time manual setup

These steps require your own Supabase and Vercel accounts/credentials and
can't be done from an automated agent session — do them once, yourself:

### 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/0001_init.sql`, then
   `0002_feedback_loop.sql`, then `0003_platform_publishing.sql`, in that
   order, via either:
   - **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`, or
   - **Dashboard SQL editor:** paste the contents of each migration file and run it.
3. Confirm the tables exist (Table Editor, or
   `select table_name from information_schema.tables where table_schema = 'public';`)
   — you should see `content_items`, `platform_posts`, `agent_logs`,
   `weekly_reviews` (after 0002), and `platform_tokens` (after 0003).
4. Create your one user account manually: Authentication → Users → Add user
   (email + password). There is intentionally no public signup page.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API. Fill in
`ANTHROPIC_API_KEY` to run the Phase 1 QA calibration and/or the Phase 2
Research/Draft/QA agents (get one from the
[Anthropic Console](https://console.anthropic.com)). To run the Phase 3
asset pipeline, also fill in:

- `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (pick a calm/measured voice
  from your [ElevenLabs Voice Library](https://elevenlabs.io/voice-library)
  and copy its ID) + `ELEVENLABS_COST_PER_1K_CHARS_USD` (match your plan's
  actual per-character rate — see the comment in `.env.local.example`,
  there's no single universal rate the way there is for Anthropic).
- `SHOTSTACK_API_KEY` + `SHOTSTACK_STAGE=v1` (use `v1`, not `stage`, for
  anything you intend to actually publish — see "Deviations" for why this
  also doubles as the pipeline's watermark check) + optionally
  `SHOTSTACK_COST_PER_MINUTE_USD` to match your plan.
- `PEXELS_API_KEY` (free — [pexels.com/api](https://www.pexels.com/api)).
- `KLING_API_KEY` + `ENABLE_KLING_BROLL=true` only if you want AI B-roll
  clips — the pipeline runs fully on Pexels images alone with this left
  unset/false, which is the recommended default until you've reviewed the
  Kling integration notes in "Deviations" below.
- `CRON_SECRET` — any random string of 16+ characters. Required for the
  render-status poller (`app/api/cron/check-renders`) to accept requests;
  Vercel sets this automatically as an `Authorization: Bearer` header on
  its own cron invocations once you add the same value as a Vercel project
  env var.

To run the Phase 5 publish pipeline, also complete the one-time OAuth
setup in step 3 below and fill in the YouTube/Instagram/TikTok variables
it produces. Leave them blank until then.

### 3. OAuth setup for Phase 5 platform publishing

Per the Phase 5 brief's own instruction: these are one-time, manual,
out-of-band consent flows — document them, don't try to automate the
initial consent. Skip this step entirely if you're not running the
publish pipeline yet; nothing else in this repo depends on it.

**YouTube:**
1. Create a Google Cloud project, enable the **YouTube Data API v3**.
2. Create an OAuth 2.0 Client ID (type: **Desktop app**) — copy the client
   ID/secret into `YOUTUBE_CLIENT_ID`/`YOUTUBE_CLIENT_SECRET`.
3. Run the consent flow once, locally, with a script using the
   `googleapis` client (already a dependency here) and the
   `https://www.googleapis.com/auth/youtube.upload` scope, authorizing
   against your own channel. Store the resulting `refresh_token` as
   `YOUTUBE_REFRESH_TOKEN` — it doesn't expire unless revoked, so this is
   genuinely one-time.

**Instagram:**
1. Create a Meta Developer app, add the **Instagram Graph API** product.
2. Link an Instagram Business/Creator account to a Facebook Page (Meta
   requires this — the newer accountless "Instagram API with Instagram
   Login" product is a different, incompatible integration path from the
   one this codebase implements).
3. Run the Facebook Login flow once to get a short-lived user token, then
   exchange it for a long-lived one (`grant_type=fb_exchange_token`) —
   store that as `INSTAGRAM_ACCESS_TOKEN` (seeds `platform_tokens` on
   first use; the weekly refresh cron takes over from there).
4. Note your Instagram **Business Account ID** (not your Facebook Page ID
   — Graph API Explorer's `/me/accounts` → the linked Page →
   `instagram_business_account` field) as `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
5. Copy the app's ID/secret into `INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`
   — required for the weekly token-refresh cron's `fb_exchange_token`
   call, not just the initial consent flow.

**TikTok:**
1. Confirm your Content Posting API app registration was submitted for
   audit back in Phase 0. **If it wasn't yet, flag this back to yourself
   immediately and submit it now** — audit turnaround is a 1-6 week
   external clock, and until it clears, the TikTok agent runs in its
   `TIKTOK_AUDITED=false` branch (defers to manual posting, see below).
2. In the TikTok Developer portal, verify your Supabase Storage domain
   (`<project-ref>.supabase.co`) as a **URL property** — required for the
   `PULL_FROM_URL` publish method this codebase uses; unverified URLs are
   rejected outright by TikTok's API, not just discouraged.
3. Copy `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` from the app.
4. Run the OAuth consent flow once to get an initial `access_token` +
   `refresh_token` (365-day lifetime) — store as `TIKTOK_ACCESS_TOKEN`/
   `TIKTOK_REFRESH_TOKEN` (seeds `platform_tokens` on first use; the daily
   refresh cron takes over from there, rotating the refresh token on every
   use).
5. Leave `TIKTOK_AUDITED=false` until TikTok actually approves the app,
   then flip it to `true` manually — this is the flag the TikTok publish
   agent branches its entire behavior on.

### 4. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you should be redirected to `/login`. Sign
in with the user you created in step 1 and you should land on `/dashboard`.

### 5. Deploy

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the repo into a new Vercel project.
3. Add every variable from `.env.local.example` to Vercel's Project Settings
   → Environment Variables, for both **Production** and **Preview**.
4. Deploy, then confirm the deployed URL loads `/login` and, after signing
   in, reaches `/dashboard`.

### 6. Run the Phase 1 QA calibration

With `ANTHROPIC_API_KEY` set in `.env.local`:

```bash
npm run qa:calibrate
```

This runs 10 compliant + 10 non-compliant fictional scripts
(`qa-calibration/`) through the QA agent and reports whether its verdicts
match `qa-calibration/manifest.json`'s expectations. Per
`docs/brand-voice-qa-rubric.md`, the QA agent should not be wired into any
live route until this passes consistently.

### 7. Run the Phase 2 pipeline

With every Supabase and `ANTHROPIC_API_KEY` variable set, sign in on
`/dashboard` and click **Generate New Case** — this calls
`/api/agents/run-pipeline`, which runs Research → Draft → QA end to end and
shows the resulting case title, `stage`, and `qa_result`. You can also
trigger it directly:

```bash
curl -X POST http://localhost:3000/api/agents/run-pipeline \
  -H "Content-Type: application/json" \
  -d '{"seedTopic": "unsolved poisoning", "seedRegion": "KwaZulu-Natal"}'
```

Every Anthropic call this makes is logged to `agent_logs` with a non-null
`cost_usd`; check that table to see the full audit trail (and to see
exactly where the chain stopped, if it didn't reach `qa_passed`/
`qa_rejected`).

### 8. Run the Phase 3 asset pipeline

With every Phase 3 env var set (ElevenLabs, Shotstack, Pexels, and
optionally Kling — see step 2), take a `content_items` row that's already
at `stage = 'qa_passed'` (from step 6) and run:

```bash
curl -X POST http://localhost:3000/api/agents/asset/voiceover \
  -H "Content-Type: application/json" \
  -d '{"contentItemId": "<uuid of a qa_passed row>"}'
```

This generates the narration and submits the main video render, then
returns immediately (per the brief's "do not poll synchronously" rule).
The rest — polling both renders, kicking off the vertical cut + thumbnail
once the main video is done, and running asset QA — happens via the cron
job. Locally, since `vercel dev`/cron emulation isn't in play, trigger a
tick by hand:

```bash
curl http://localhost:3000/api/cron/check-renders \
  -H "Authorization: Bearer $CRON_SECRET"
```

Run that repeatedly (every couple of minutes, matching the real cron
schedule) until `content_items.stage` reaches `assets_generated`, or check
`agent_logs` / `asset_urls.qa_failure_reason` if it stalls. On a real
Vercel deployment, `vercel.json`'s cron config does this automatically —
**but note the `*/2 * * * *` schedule requires a Vercel Pro (or higher)
project**; the Hobby plan caps cron jobs at once per day and will reject
this schedule at deploy time (see "Deviations" below).

Two new Supabase Storage buckets (`voiceover-audio`, `rendered-videos`)
plus `thumbnails` are created automatically on first use — nothing to
provision manually beyond the schema in step 1.

### 9. Exercise the Phase 4 feedback loop

Manually reject a `content_items` row that's already at `stage =
'qa_passed'` or `stage = 'assets_generated'`:

```bash
curl -X POST http://localhost:3000/api/content-items/<uuid>/reject \
  -H "Content-Type: application/json" \
  -d '{"reason": "Too sensationalized in the opening hook"}'
```

...or approve one the same way, with no body:

```bash
curl -X POST http://localhost:3000/api/content-items/<uuid>/approve
```

To confirm the Draft agent's rolling rejection context is actually wired
in and doing something: seed a handful of rows with the same repeated
`rejection_reason` (e.g. "too sensationalized" via the reject endpoint
above, or by letting the QA agent fail a few drafts for the same reason),
then trigger a fresh `run-pipeline` call and check the next draft visibly
avoids that pattern. To confirm prompt caching is actually active (not
just "the field is set and nothing crashed"): run the Draft agent twice in
a row within the same 5-minute window and check `agent_logs.output_
summary` for the second call — it should report a non-zero cache-read
count.

Run the weekly review cron by hand the same way as `check-renders`:

```bash
curl http://localhost:3000/api/cron/weekly-review \
  -H "Authorization: Bearer $CRON_SECRET"
```

This inserts one row into `weekly_reviews` covering the trailing 7 days
from whenever you run it — real numbers even if very few (or zero)
`content_items` were processed in that window (see "Deviations" for how
`items_processed`, `qa_pass_rate`, and `human_approval_rate` are computed
so they never come back null).

### 10. Run the Phase 5 publish pipeline

With every Phase 5 env var set (step 3), take a `content_items` row at
`stage = 'assets_generated'` and make sure `scheduled_at` is set to a
past/current timestamp — either via the approve endpoint (which defaults
`scheduled_at` to "now" if you don't pass one):

```bash
curl -X POST http://localhost:3000/api/content-items/<uuid>/approve
```

...or directly:

```bash
curl -X POST http://localhost:3000/api/cron/publish-scheduled \
  -H "Authorization: Bearer $CRON_SECRET"
```

Run that repeatedly (every ~15 minutes, matching the real cron schedule)
until all three `platform_posts` rows for the item reach a terminal state
and `content_items.stage` becomes `'published'` — Instagram/TikTok's
submit-then-poll flows can legitimately take a few ticks (container/
publish-job processing time), same as Phase 3's render polling. Check
`platform_posts` directly to see each platform's individual status,
`provider_job_id` (while in flight), and `error_message` (on failure)
without waiting for all three to finish. You can also re-trigger a single
platform directly instead of waiting for the full scheduler tick:

```bash
curl -X POST http://localhost:3000/api/agents/publish/youtube \
  -H "Content-Type: application/json" \
  -d '{"contentItemId": "<uuid>"}'
```

To verify TikTok's `TIKTOK_AUDITED` branching (Definition of Done, section
7): with it `false`, confirm the `platform_posts` row for `tiktok` reaches
`status = 'ready'` with an `agent_logs` row logged as `success` (not
`fail`) and that no TikTok API call was ever made (nothing in TikTok's own
developer dashboard/analytics). Flip it to `true` and confirm a *new*
item's TikTok row instead goes through `pending` (with a `provider_job_id`
set) before reaching `posted`.

Run the two token-refresh crons by hand the same way:

```bash
curl http://localhost:3000/api/cron/refresh-ig-token -H "Authorization: Bearer $CRON_SECRET"
curl http://localhost:3000/api/cron/refresh-tiktok-token -H "Authorization: Bearer $CRON_SECRET"
```

### 11. Exercise the Phase 7 dashboard and confirm the sequencing fix

Sign in at `/login`, then trace one item through the full lifecycle to
confirm the fix in "Phase 7 — Phase 3/4/5 sequencing fix" above actually
holds:

1. Click "Generate New Case" on `/dashboard` (Research → Draft → QA).
2. Once it reaches `qa_passed`, go to `/dashboard/review` — the item
   should appear there. **Check `asset_urls` on the row directly in
   Supabase right now: it should still be empty (`{}`).** This is the
   actual assertion the brief's Definition of Done cares about — assets
   must not exist yet at this point.
3. Optionally edit the script/captions inline, pick a `scheduled_at`, and
   click Approve. Confirm the row moves to `stage = 'scheduled'` and
   `asset_urls.voiceover_url` gets populated within the same request (the
   approve endpoint calls the asset pipeline directly) — or, if that call
   happened to fail, within ~2 minutes via `check-renders`' safety net.
4. Let `check-renders` run (every 2 minutes) until the row reaches
   `stage = 'assets_generated'`.
5. Once `scheduled_at` has passed, let `publish-scheduled` run (every 15
   minutes, or trigger it manually per step 10) until `stage = 'published'`.
6. Check `/dashboard/calendar` for the item's card and `/dashboard/analytics`
   for its contribution to the cost-per-item and posts-by-platform numbers.

## Deviations from the task brief

The original task brief asked for a `middleware.ts` file. This project was
scaffolded with **Next.js 16**, which renamed the `middleware.ts` file
convention to `proxy.ts` (same behavior, new file name/export — see the
[Next.js Proxy docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)).
`middleware.ts` still works in v16 for backward compatibility, but is
deprecated, so `proxy.ts` was used instead to avoid shipping a deprecated
pattern in a codebase meant to be extended by future AI agent sessions.
Flagging this back per the brief's own constraints rather than silently
diverging.

No other Phase 0 deviations were made. The database schema, RLS policies,
and env var list match that brief exactly.

Phase 1 (the brand voice & QA rubric) is a content/rubric spec, not a code
task brief, so there's no fixed file list to diff against — everything
under `docs/brand-voice-qa-rubric.md`, `lib/agents/qa/`, and
`qa-calibration/` is a direct implementation of that document's section 6
(scoring rubric) and section 7 (the calibration step it explicitly asks
for). See `docs/brand-voice-qa-rubric.md` for the full spec and a note on
how each part maps to code.

Phase 2 deviations, each small and flagged rather than silently made:

- **`logAgentCall`'s `contentItemId` is typed `string | null`, not
  `string`.** The brief's own `logAgentCall` code sample types it as a
  required `string`, but the Research agent can fail (bad API response,
  unparseable JSON) *before* any `content_items` row exists to attach a log
  to — and the brief still requires that failure to be logged. The
  `agent_logs.content_item_id` column from the Phase 0 migration is already
  nullable, so this is a type-level fix to let a real, spec-required
  scenario compile, not a schema or behavior change.
- **`lib/rubric.ts` duplicates rubric content that also lives in
  `lib/agents/qa/rubric.ts` (Phase 1's calibration module), in a different
  shape.** The Phase 2 brief explicitly asks for a fresh, hardcoded
  `RUBRIC_TEXT` string + `QA_AXES` array shaped `{ name, passCriteria,
  failCriteria }`, independent of any runtime file read — which is a
  different shape than Phase 1's `{ id, label, ... }` axis definitions
  (built for a different purpose: structured tool-use output during
  calibration). Both are faithful transcriptions of the same source
  document (`docs/brand-voice-qa-rubric.md`); if the rubric changes, both
  files need updating. Not deduplicated because the Phase 2 brief asks for
  this file specifically and doesn't reference or ask to touch Phase 1's
  module.
- **`web_search_20250305` capped at `max_uses: 5`.** The brief doesn't
  specify a cap; left unbounded, a single Research call could rack up an
  unpredictable number of searches (and cost) if the model gets into a
  long back-and-forth. Five searches is generous for one case brief and
  bounds the worst case.
- **Chain-failure handling: a Draft or QA failure inside the automatic
  Research → Draft → QA chain is caught and logged, not re-thrown**, so
  `run-pipeline` (and a direct call to `/api/agents/research`) still
  returns 200 with whatever `content_items` row state was last reached
  (e.g. `stage: 'researched'` if Draft failed). Only a Research-agent
  failure — before any row exists — returns a 500, per the brief's explicit
  instruction for that case. This interpretation was necessary because the
  brief doesn't spell out the HTTP-level behavior for a downstream chain
  failure, only "logged, not silently swallowed, no automatic retry" — the
  row's own `stage` field and `agent_logs` are what tell a human how far it
  got, exactly as the brief's error-handling section describes. Calling the
  standalone `/api/agents/draft` or `/api/agents/qa` route *directly*
  still returns a 500 on that same failure, since there's no downstream
  step masking it in that case.

Phase 3 deviations, each flagged rather than silently made:

- **"The Kling API" has no single canonical public spec, so `kling.ts`
  targets fal.ai's hosted Kling endpoint specifically** (`fal-ai/kling-
  video/v3/pro/text-to-video`), not a generic/unverifiable one. Kling
  itself (by Kuaishou) doesn't offer a simple first-party developer API;
  it's accessed through third-party hosts, and fal.ai is the best-
  documented, highest-trust one with a stable, versioned REST queue API
  (submit → poll status → fetch result) — verified against fal.ai's own
  API reference rather than guessed. `KLING_API_KEY` is used as the fal.ai
  API key. If you have a different Kling provider preference, `kling.ts`
  is the one file to change; `KLING_FAL_MODEL_ID` is already
  env-configurable.
- **Kling B-roll defaults to off (`ENABLE_KLING_BROLL`).** It's explicitly
  "optional" per the brief, real API access/pricing for it couldn't be
  verified against actual credentials in this environment, and gating it
  behind a flag means the default pipeline path (Pexels images only) is
  simpler, cheaper, and fully functional without it. When enabled, Kling
  job submission/polling still goes through the same submit-then-poll-via-
  cron pattern as Shotstack renders — no exceptions to the "no synchronous
  polling" constraint, even for the optional path.
- **Asset QA's resolution, caption-presence, and watermark checks are
  deterministic (by construction / by Shotstack stage) rather than
  re-inspected from the rendered output**, with ffprobe layered on top as
  a genuine but non-required cross-check. Reliably bundling ffprobe's
  native binary inside a standard Vercel serverless Function is a
  widely-reported, still-unresolved problem (binary path resolution breaks
  post-build, and Vercel Function bundles have a hard 250MB unzipped size
  cap) — real fixes require either a Dockerfile-based Vercel Function or
  Vercel Sandbox, both of which are significant infrastructure additions
  beyond what this phase asks for. Since we submit every render with an
  explicit, fixed `output.resolution`/`aspectRatio`, and Shotstack either
  honors that or the render's own status comes back `failed` (handled
  separately, before QA ever runs), asserting the *request* rather than
  re-measuring the *response* is a legitimate, more robust check for this
  deployment target. The watermark check leans on a real, documented
  Shotstack behavior: production (`v1`) renders carry no watermark,
  sandbox (`stage`) renders do — asserting `SHOTSTACK_STAGE=v1` is exactly
  what "no watermark" means, not an assumption. `ffprobe.ts` is still
  implemented and wired in (`probeMediaBestEffort`) for deployments where
  the binary does happen to run; it degrades to `null` (never throws) on
  any failure, so it can only add stricter checks, never break the
  pipeline.
- **Splitting `script_text` back into the 6 structural beats is a
  heuristic (`lib/agents/pipeline/assets/beats.ts`), not an exact parse.**
  The Draft agent's output (Phase 2) is a single narration string with no
  embedded beat markers — the brief specifies WHAT to split into, not HOW
  to recover beat boundaries from plain prose. The common case (the model
  wrote 6 blank-line-separated paragraphs, one per beat, because its
  system prompt told it to follow a 6-beat structure) is handled exactly;
  anything else falls back to a proportional sentence-level split against
  each beat's target share of runtime, from the Phase 1 template's own
  timestamps. Flagging this because it's inherently approximate, not
  because it's untested — see the smoke test results below.
- **Beat/scene timing is derived from an estimated narration duration**,
  preferring a real ffprobe measurement of the generated voiceover file
  when available and falling back to a words-per-minute estimate (140
  wpm, a calm/measured narration pace) otherwise — same ffprobe
  availability caveat as above.
- **`asset_urls` carries a few extra internal-bookkeeping keys beyond the
  exact shape in the brief's section 4** (`beat_plan`, `main_render_
  submitted`, `qa_failure_reason`). The brief itself notes `asset_urls` is
  jsonb specifically so nothing new needs migrating; these extra keys are
  what let the cron job resume a multi-step, multi-tick job (Kling
  resolution → main render → vertical render → QA) without re-deriving
  the beat plan, image choices, and Kling job IDs from scratch on every
  tick, and without re-running asset QA on an item that already failed it
  (see the `!qa_failure_reason` guard in `cron.ts`'s dispatch logic — this
  is what actually satisfies the brief's "doesn't double-process
  already-completed [or already-failed] ones").
- **ElevenLabs/Shotstack per-unit costs are env-configurable, not
  hardcoded**, unlike Phase 2's Anthropic pricing. Anthropic's per-model
  rate is the same for everyone; ElevenLabs (per-character) and Shotstack
  (per-minute) pricing depends on which plan tier you're subscribed to, so
  a single hardcoded number would silently misreport cost for anyone not
  on the exact tier this build defaults to. `ELEVENLABS_COST_PER_1K_CHARS_
  USD` and `SHOTSTACK_COST_PER_MINUTE_USD` default to a representative
  pay-as-you-go rate (verified against each provider's public pricing as
  of this build) but should be set to match your actual plan.
- **The vertical cut's thumbnail is generated with `sharp`, not a third
  Shotstack render**, per the brief's own "this can be a Shotstack
  single-frame render or a simpler direct image composition; either is
  fine, don't overbuild this part." `sharp` was chosen specifically
  because Next.js itself depends on it for `next/image` optimization, so
  unlike ffmpeg/ffprobe it's already known to work reliably in Vercel's
  Node.js serverless runtime.
- **The cron route's `maxDuration` is set to 300 seconds**, which requires
  a paid Vercel plan (Hobby caps Node.js functions at 60s); downloading
  and re-uploading a multi-minute video within one tick can plausibly
  exceed Hobby's limit. Combined with the Pro-plan-only `*/2 * * * *`
  cadence noted above, this phase's render-polling infrastructure assumes
  a Vercel Pro (or higher) project — flagging this explicitly since the
  brief's own `vercel.json` snippet doesn't call it out.

Phase 4 deviations, each flagged rather than silently made:

- **`content_items.updated_at` never actually refreshed on `UPDATE` before
  this phase** — the Phase 0 migration only defaulted it on `INSERT`, so
  every row's `updated_at` was frozen at creation time. Phases 2 and 3
  never depended on it being accurate; Phase 4 is the first phase whose
  correctness genuinely requires it (`getRecentRejectionsContext`'s "most
  recently rejected" ordering, and the weekly review's "created/updated in
  the trailing 7 days" query). Added a
  `content_items_set_updated_at` trigger in `0002_feedback_loop.sql` to fix
  this at the schema level rather than trying to patch every existing
  `.update()` call-site to set it manually (which would be easy to forget
  on the next one added later).
- **The rolling rejection context query
  (`lib/getRecentRejections.ts`) doesn't filter on `qa_result = 'fail'`
  alone, unlike the brief's literal code sample.** The reject endpoint
  deliberately never overwrites `qa_result` on a human rejection (see the
  next point for why) — so a `qa_result = 'fail'` filter would only ever
  surface QA-agent rejections and silently drop every human rejection
  entirely, directly contradicting section 2's own framing that "both are
  real signal for the feedback loop." The query instead matches
  `qa_result = 'fail' OR rejected_by = 'human'`, which restores both
  sources while still tagging each line with its `rejected_by` value so
  they stay visually distinct in the block, exactly as the brief's
  formatting already does.
- **The reject endpoint never overwrites `qa_result`.** Section 3's own
  field list for this endpoint doesn't mention `qa_result` either — only
  `stage`/`rejected_by`/`rejection_reason` — but this is also load-bearing,
  not just literal: section 5.1 defines `qa_pass_rate` as "percentage where
  `qa_result = 'pass'` on first QA agent pass (**not counting human
  overrides**)". With only mutable current-state columns and no event
  history table, that stat is only computable at all if a human override
  never touches `qa_result` in the first place — otherwise "first QA agent
  pass" data is destroyed the moment a human rejects something, and there'd
  be no way to recover it later. `rejected_by = 'human'` is what marks the
  override instead; `qa_result` keeps meaning exactly what the QA agent
  decided, forever.
- **Both the reject and approve endpoints guard that the item is at a
  stage that means "already passed automated QA"** (409 otherwise),
  beyond the brief's literal minimum-viable spec — rejecting/approving
  anything earlier in the pipeline (e.g. `researched`, `scripted`) would
  mean the review queue is calling these out of order. **Updated in
  Phase 7**: approve's guard is now `qa_passed` only (tightened from also
  allowing `assets_generated`, once `assets_generated` became strictly
  downstream of an already-approved `scheduled` item — approving it again
  would re-trigger asset generation); reject's guard gained `scheduled`
  (a human can still pull an item back after approving it, before assets
  finish).
- **`items_processed` (section 5.1) is computed as `qa_result IS NOT
  NULL`, not `stage = 'qa_pending'`.** `stage` never actually parks at
  `qa_pending` in this codebase — Draft immediately chains into QA
  in-process (`lib/agents/pipeline/draft.ts`), so any write of `stage =
  'qa_pending'` would be overwritten by the same function call before it's
  ever observable in a later query. `qa_result IS NOT NULL` is the
  practical equivalent: it's set exactly once, exactly when the QA agent
  actually scores an item, regardless of pass/fail — the same event the
  brief's `qa_pending` checkpoint was trying to capture.
- **The Draft agent's system prompt caches the entire existing
  `DRAFT_SYSTEM_PROMPT` string as one block, not `RUBRIC_TEXT` alone as a
  separate block**, unlike the brief's exact two-block sample. Since Phase
  2, `RUBRIC_TEXT` is already embedded inline inside `DRAFT_SYSTEM_PROMPT`
  as one static compile-time string, and nothing in that string changes
  independently of anything else in it — Anthropic's cache breakpoints
  cache everything up to that point as a single unit regardless of how many
  blocks it's split into, so this has identical caching behavior to the
  brief's sample without adding prefix/suffix string-splitting complexity
  that would buy nothing.
- **`lib/logAgentCall.ts`'s cache-token accounting is new, not in the
  brief.** The brief calls prompt caching "a real cost lever" and asks you
  to *verify* it's active, but doesn't ask for cost tracking to actually
  account for the cheaper cache rates. Left as pure `inputTokens` math,
  every Draft agent call after the first in a cache window would silently
  *overstate* `cost_usd` (charging the full $2.00/M input rate for tokens
  that actually cost $0.30/M) — which runs directly against Phase 2's own
  "flag pricing issues, don't silently guess" cost-tracking principle this
  codebase has followed since Phase 2. Extended `PRICING` and the cost
  formula to close that gap rather than leave a known-wrong number in
  `agent_logs`.
- **`agent_logs.agent_name`'s check constraint gained a `'weekly_review'`
  value.** The Haiku clustering call (section 5.3) doesn't fit
  `research`/`draft`/`qa`/`asset`/`publish`, and section 5.5 explicitly
  still requires logging it "as usual" — there's no existing category to
  reuse without mislabeling what actually happened.
- **`top_rejection_themes`'s clustering prompt explicitly allows returning
  fewer than 3 themes** if the week's data doesn't support 3 genuinely
  distinct ones, deviating from the brief's literal "3-5" instruction in
  that one edge case. This follows the brief's own Definition of Done more
  literally than "3-5" does: section 6 explicitly says "if the first run
  looks degenerate, tighten the Haiku prompt rather than shipping noisy
  output" — manufacturing filler themes to pad a low-signal week up to 3
  is exactly the kind of noisy output that instruction rules out.

Phase 5 deviations, each flagged rather than silently made:

- **The Phase 4 `approve` endpoint's behavior was corrected once this
  phase's actual scheduling logic was known.** It originally set
  `stage = 'scheduled'` — the Phase 4 brief's own suggested fallback,
  written before this brief existed ("or whatever the next stage is per
  your scheduling logic from Phase 5"). This brief's scheduler queries
  `stage = 'assets_generated' AND scheduled_at <= now()` and never checks
  for `stage = 'scheduled'` at all, so the original behavior would have
  made every approved item permanently invisible to the publish cron.
  Fixed on the Phase 4 branch itself (not patched around here) so the
  fix is visible in Phase 4's own history — approve now sets
  `scheduled_at` (defaulting to "now") instead of advancing `stage`. See
  that route's own comment and Phase 4's PR for the full story.
  `content_items.stage`'s `'scheduled'` enum value was consequently unused
  by any code in this repo at the time — left in place rather than
  removed. **Phase 7 gave it a real, load-bearing meaning**: it's now the
  stage an item sits at between human approval and the asset pipeline
  finishing, and the trigger the asset pipeline itself watches for — see
  "Phase 7 — Phase 3/4/5 sequencing fix" above. That earlier "corrected"
  behavior (approve sets only `scheduled_at`, never touches `stage`) is
  itself superseded by Phase 7; this bullet is left here as the historical
  record of why the endpoint changed the way it did across three phases.
- **Both Instagram and TikTok use a submit-then-poll-via-cron state
  machine across scheduler ticks, not synchronous in-request polling**,
  even though section 4/5's prose ("poll... until FINISHED"/"poll for
  PUBLISH_COMPLETE") doesn't explicitly say which. This is necessary, not
  just consistent-with-Phase-3 stylistic preference: TikTok's own docs
  state a `PULL_FROM_URL` download can take up to **one hour**, which
  cannot fit inside any single bounded serverless function call (Vercel's
  absolute ceiling is 300s on Pro, 800s on Enterprise). `platform_posts`
  gained a `provider_job_id` column (Instagram's container id / TikTok's
  `publish_id`) specifically so a later scheduler tick resumes polling an
  already-submitted job instead of creating a duplicate one — the same
  discipline Phase 3 established for Shotstack renders and Kling B-roll
  jobs, generalized to Phase 5's own async publish flows. YouTube doesn't
  need this: `videos.insert` returns the final resource in one call, so
  its agent is a plain single-attempt success/fail, no state machine.
- **Instagram and TikTok publish `asset_urls.vertical_video_url` (the
  short cut with burned-in captions), not `asset_urls.main_video_url`.**
  Neither brief section explicitly says which asset each platform uses —
  section 3 (YouTube) is the only one that names a specific field
  (`main_video_url`) — but Reels/TikTok are inherently short-form vertical
  formats, which is the entire reason Phase 3 built a separate vertical
  cut in the first place. Using the long-form main video for either would
  be a structural mismatch (aspect ratio, duration), not a plausible
  reading of the brief's intent.
- **`INSTAGRAM_APP_ID`/`INSTAGRAM_APP_SECRET`/`INSTAGRAM_BUSINESS_ACCOUNT_ID`
  are new env vars beyond the brief's section 2 list**, which only
  mentions `INSTAGRAM_ACCESS_TOKEN`. All three are unavoidable: the
  `fb_exchange_token` refresh call needs the app id/secret (not just the
  token), and every publish/status-check call needs the `{ig-user-id}` to
  build its URL. Similarly, `TIKTOK_ACCESS_TOKEN`/`TIKTOK_REFRESH_TOKEN`
  are new (the brief only lists `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET`
  beyond `TIKTOK_AUDITED`) — the one-time OAuth consent flow the brief
  itself asks for produces these, and something has to hold them until
  `platform_tokens` takes over (see `lib/platformTokens.ts`'s bootstrap
  logic).
- **A `platform_tokens` table was added (not just suggested as an
  alternative)** — the brief phrases this as "the env var store (Vercel
  API) **or** a dedicated platform_tokens table if you'd rather not touch
  env vars programmatically," presenting it as a choice. Programmatically
  mutating Vercel's env vars from application code requires the Vercel
  API token to be available at runtime (a meaningful new secret/attack
  surface) and has no read-after-write consistency guarantee across
  concurrently-running serverless invocations; a Postgres table already
  has both properties for free. The brief's own phrasing ("a small table
  ... is cleaner") reads as a mild preference toward the table anyway.
- **YouTube's `title`/`description` are defensively truncated** to
  YouTube's documented 100/5000-character field limits before upload,
  rather than trusting `case_title`/`platform_variants.youtube_desc` to
  always be short enough. Cheap insurance against a single edge-case-long
  value turning into a `400 badRequest` that silently blocks an otherwise-
  successful upload.
- **TikTok's `privacy_level` picks `PUBLIC_TO_EVERYONE` from
  `creator_info`'s `privacy_level_options` if present, else falls back to
  the first available option.** The brief says to use "a privacy level
  from the queried options" without specifying which; for a public
  channel, the most public-facing available option is the only sensible
  default, with a graceful fallback for accounts/regions where that
  specific option isn't offered.
- **No pre-publish duration check against TikTok's
  `max_video_post_duration_sec`.** Phase 3's vertical cuts target a
  30-60s "strongest beat," comfortably under any realistically-reported
  creator minimum (community reports range from roughly 60s to several
  minutes depending on account type) — trusted by design rather than
  re-verified at publish time, since doing so would require re-probing
  the rendered file (the same `ffprobe` availability caveat as Phase 3)
  for a check that's very unlikely to ever fire in practice.
- **`asset_urls.thumbnail_url` (Phase 3's generated thumbnail) isn't used
  anywhere in this phase.** YouTube's custom-thumbnail endpoint
  (`thumbnails.set`) isn't in the brief's own YouTube publish steps
  (only `videos.insert` with `part=snippet,status`), and it additionally
  requires phone-number verification on the channel — an extra manual
  prerequisite the brief doesn't ask for either. Flagging this as a known
  gap rather than a silent omission, in case a future phase wants to wire
  it in.
- **A `'ready'` TikTok `platform_posts` row (from a `TIKTOK_AUDITED=false`
  deferral) is treated as terminal forever, even if `TIKTOK_AUDITED` is
  later flipped to `true`.** Once flagged for manual posting, a human may
  already have acted on it outside this system by the time the flag
  flips; re-attempting via the API at that point risks a duplicate post.
  Only items that first reach `assets_generated` *after* the flip go
  through the audited API path — not a re-scan of previously-deferred
  ones.

Phase 7 deviations, each flagged rather than silently made:

- **The Phase 3/4/5 sequencing fix (section 0 of this phase's own brief)
  touches files from three earlier phases** (`approve/route.ts`,
  `reject/route.ts`, `voiceover.ts`, `cron.ts`) rather than being confined
  to new dashboard code. The brief itself calls this out explicitly
  ("closes a sequencing gap... that needs fixing first" / "don't skip
  section 0's fix to 'save time'"), so this isn't scope creep — it's the
  brief's own first, mandatory deliverable.
- **The asset pipeline kickoff is triggered two ways, not one**: directly
  from the approve endpoint (fast path — no waiting for the next cron
  tick) *and* as a safety-net branch in `check-renders` for any
  `'scheduled'` item that doesn't have a `voiceover_url` yet. The brief
  phrased this as an "either/or" choice ("either call the asset-assemble
  endpoint directly from the approve action... or add a cron check").
  Both were built because they cover different failure modes: the direct
  call gives immediate, low-latency kickoff in the common case, while the
  cron safety net is the only thing that recovers an item stuck at
  `'scheduled'` with no assets if that direct call fails, times out, or
  the request is interrupted after the `stage` update commits but before
  the asset call runs. `runVoiceoverAgent` was made idempotent
  specifically so these two paths can safely coexist without ever
  double-billing ElevenLabs.
- **The review queue's data fetch is a direct Server Component Supabase
  query, not a new `GET` API route** — consistent with how
  `app/dashboard/page.tsx` already used `createClient()` directly rather
  than calling its own API, and avoiding a pure-read API layer this
  single-user app has no other use for. Mutations (approve/reject/PATCH)
  still go through API routes, since those need to be callable from a
  Client Component's `fetch()`.
- **The calendar's rate-limit headroom indicator counts `status =
  'posted'` rows by calendar day (using each row's own `posted_at`
  date), not a true rolling 24-hour window ending "right now."** The
  brief's actual enforcement (`lib/agents/pipeline/publish/shared.ts`'s
  `isRateLimited`) is correctly rolling-24h and unaffected by this — this
  is a display-only simplification, necessary because a day-grid UI has
  no natural way to show a constantly-sliding window per cell, and a
  per-calendar-day count is what "matches what a manual count of today's
  platform_posts would show" (the brief's own Definition of Done wording)
  actually means for a single, static day.
- **YouTube's daily cap (100) shown on the calendar is not backed by any
  runtime check anywhere in this codebase** — see `lib/platformCaps.ts`'s
  own comment. It's included because the brief explicitly asks for it
  ("YouTube ~100/day") as a display figure; Phase 5 deliberately never
  built quota-conservation logic for YouTube since it won't bind at any
  realistic volume this pipeline runs at.
- **Analytics' cost-per-content-item average is computed across every
  content item with at least one costed `agent_logs` row, not scoped to
  `stage = 'published'` items only.** The brief's own instruction ("Total
  cost_usd summed per content_item_id, then averaged") doesn't specify a
  stage filter. Restricting to published items only would understate the
  pipeline's real cost by silently dropping every rejected/failed
  attempt's already-spent cost from the denominator — the opposite of
  what "your real cost-per-published-post... replacing the estimate with
  actuals" is asking for. (There is no Phase 6 in this codebase to
  "replace an estimate" from — Phase 6 was never built; this phase
  computes the real number from scratch.)
- **The "posts by platform" bar chart and the "failed" count both filter
  `platform_posts` by `created_at` within the selected week**, not by
  `posted_at` (which is `null` for anything that hasn't posted, including
  every failed attempt). `created_at` is the one timestamp every row has
  unconditionally, making it the only consistent way to answer "what
  publishing activity happened this week" across both successful and
  failed attempts in one query.
- **No live end-to-end test against a real Supabase project with real
  data was possible in this environment** (no provisioned project, no
  `docker`/Supabase CLI available to run a local stack) — see Definition
  of Done below for exactly what was and wasn't verified as a result.

## Definition of done — Phase 0

- [x] `npm run build` succeeds with zero TypeScript errors
- [ ] All 3 tables exist in Supabase with RLS enabled and policies applied — *pending: requires running the migration against your own Supabase project (see step 1 above)*
- [ ] Login flow works end-to-end on the deployed Vercel URL — *pending: requires your own Vercel deployment (see step 4 above)*
- [x] `.env.local` is gitignored and never appears in any commit
- [x] `.env.local.example` is committed and lists every variable through Phase 7
- [x] No agent/generation/publishing code exists yet

## Definition of done — Phase 1

- [x] Persona spec, tone pillars, banned content/phrases, structural
      template, and QA scoring rubric captured in `docs/brand-voice-qa-rubric.md`
- [x] QA agent implemented (`lib/agents/qa/`), backed by the Claude API,
      returning PASS/FAIL + per-axis score + one-sentence reason
- [x] 10 compliant + 10 non-compliant calibration fixtures + manifest + a
      runnable calibration script (`npm run qa:calibrate`)
- [ ] Calibration run confirmed passing — *pending: requires `ANTHROPIC_API_KEY` to actually execute against Claude (see step 5 above); not run in this environment because no key is available here*
- [x] QA agent is not called from any route/Server Action — confirmed not wired into the live pipeline yet

## Definition of done — Phase 2

- [x] All three routes exist (`app/api/agents/{research,draft,qa}/route.ts`)
      and each calls the Anthropic Messages API with the exact system
      prompts specified in the brief
- [x] `run-pipeline` triggers all three in sequence (Research → Draft → QA,
      chained internally, not via separate HTTP round-trips) and a
      `content_items` row ends at `qa_passed` or `qa_rejected` on the happy
      path
- [x] Every Anthropic API call is wrapped in `logAgentCall`, which computes
      a non-null `cost_usd` from hardcoded pricing and writes one
      `agent_logs` row per call, success or failure
- [x] A malformed/unparseable model response is logged as a failure
      (`AgentParseError`) and stops the chain — never silently ignored or
      retried with alternate parsing
- [x] No asset generation or publishing code; the only dashboard UI added
      is the bare `RunPipelineButton` trigger + result display
- [x] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass with
      zero errors
- [x] Manually smoke-tested against the real Anthropic API (with a
      deliberately invalid key, to exercise the failure path end-to-end):
      confirmed the 401 is caught, logged via `logAgentCall` (which itself
      degrades gracefully when Supabase is also unreachable), and returned
      as a clean 500 JSON response rather than crashing the server
- [ ] A real end-to-end run against live Claude + Supabase confirmed to
      reach `qa_passed`/`qa_rejected` — *pending: requires a real
      `ANTHROPIC_API_KEY` and a provisioned Supabase project; neither is
      available in this environment*

## Definition of done — Phase 3

- [x] A `content_items` row at `stage = 'qa_passed'` can be run through
      this pipeline end-to-end (voiceover → assemble → cron-polled render
      → vertical + thumbnail → asset QA) and reach `stage =
      'assets_generated'` with all three asset URLs populated — logic
      implemented and unit-verified (beat splitting, timeline
      construction); a real end-to-end run needs live API keys, see below
- [x] No step generates a photorealistic depiction of a real identifiable
      person — Pexels queries and Kling prompts are theme/location/object
      phrases only, Kling prompts additionally carry an explicit
      no-people/no-faces instruction and matching negative prompt; see
      `docs/asset-pipeline-safety.md` for the full policy and where it's
      enforced in code
- [x] The cron job picks up pending renders (main + vertical, Kling jobs
      when enabled) and doesn't double-process already-completed or
      already-failed ones (`main_render_submitted`, `shotstack_render_
      status`/`vertical_render_status`, and `qa_passed`/`qa_failure_
      reason` guards in `cron.ts`'s dispatch logic)
- [x] Every non-Anthropic external API call (ElevenLabs, Shotstack, Kling,
      Pexels) gets logged to `agent_logs` with an appropriate `model_used`
      label and a real `cost_usd` figure, never a null — verified by
      extending `logAgentCall` to accept a pre-computed `costUsd` for
      non-token-based APIs alongside the existing token-based path
- [x] A failed render leaves `stage` unchanged rather than silently
      advancing or disappearing, so it's queryable as stuck
      (`shotstack_render_status`/`vertical_render_status: 'failed'` +
      an `agent_logs` row with `status: 'fail'`)
- [x] No synchronous polling inside any request/response cycle — every
      async step (Shotstack renders, optional Kling jobs) is submit-then-
      poll-via-cron, no exceptions
- [x] No manual asset review/approval UI added (that's Phase 7's review
      queue) — this phase only lands assets in Supabase Storage correctly
- [x] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass with
      zero errors
- [x] Manually smoke-tested against all four real external APIs (with
      deliberately invalid keys, to verify request shape without spending
      real money): ElevenLabs, Pexels, fal.ai/Kling, and Shotstack all
      returned structured, provider-specific auth/validation errors (not
      network or malformed-request failures), confirming each
      integration's endpoint/headers/body shape is correct. Also verified
      the cron route's `CRON_SECRET` bearer-token gate (401 without/with
      wrong token) and the beat-splitting + Shotstack timeline builders
      against a sample 6-paragraph script (correct 1:1 beat mapping,
      proportional timing, valid timeline JSON shape)
- [ ] A real end-to-end run against live ElevenLabs + Shotstack + Supabase
      Storage (+ optionally Kling) confirmed to reach `assets_generated`
      — *pending: requires real API keys for all providers and a
      provisioned Supabase project with Storage enabled; none of that is
      available in this environment*

## Definition of done — Phase 4

- [x] Manually rejecting an already-QA-passed item via
      `POST /api/content-items/[id]/reject` sets `rejected_by = 'human'`
      and is distinguishable from a QA-agent rejection (`rejected_by =
      'qa_agent'`, now also set by `lib/agents/pipeline/qa.ts` on every
      automated fail) — verified via smoke test below and by inspection of
      both write paths
- [x] `reason` is a required, non-empty field on the reject endpoint — a
      missing or whitespace-only `reason` returns `400` before any
      database write happens; verified via smoke test below
- [x] The Draft agent's system prompt visibly includes the rolling
      rejections block (as its own cached text block) whenever
      `getRecentRejectionsContext()` returns non-empty content, and the
      brief's own example scenario (a repeated "too sensationalized"
      pattern) is exactly the shape of input `lib/getRecentRejections.ts`
      surfaces to it — *a live before/after draft comparison needs a real
      `ANTHROPIC_API_KEY` and a provisioned Supabase project with seeded
      rejection rows; not available in this environment, see setup step 8*
- [x] Prompt caching is wired with `cache_control: { type: 'ephemeral' }`
      on both system-prompt blocks, and every Draft agent `logAgentCall`
      now records `cache_creation_input_tokens`/`cache_read_input_tokens`
      from the real `response.usage` object (never assumed) in its
      `outputSummary` — *confirming a non-zero `cache_read_input_tokens`
      on a real second call requires a live `ANTHROPIC_API_KEY`; the
      request shape itself was verified end-to-end against the real
      Anthropic API (see smoke test below), which returned an
      authentication error only after accepting the request payload,
      confirming the `system` array + `cache_control` shape is valid*
- [x] The weekly review cron (`app/api/cron/weekly-review` +
      `vercel.json`'s `0 6 * * 1` entry) runs and produces a
      `weekly_reviews` row with real, non-null numbers even in a week with
      zero processed items — `items_processed`/`qa_pass_rate`/
      `human_approval_rate` all default to `0` (never `null`/`NaN`) when
      their denominators are zero; only `prior_week_qa_pass_rate` is
      legitimately `null`, and only on the very first run ever (no prior
      row exists yet to compare against)
- [x] `top_rejection_themes` clustering is prompted to produce genuinely
      distinct themes, explicitly instructed to keep `qa_agent`- and
      `human`-sourced rejections separate when they represent different
      concerns, and explicitly allowed to return fewer than 3 themes
      rather than manufacture filler ones on a low-signal week — *actual
      clustering quality on real data needs a live `ANTHROPIC_API_KEY` and
      real accumulated rejection reasons; not available in this
      environment*
- [x] `qa_agent` and `human` rejection sources are never conflated: the
      reject endpoint never overwrites `qa_result` (so `qa_pass_rate`
      stays a pure QA-agent metric even after human overrides),
      `human_approval_rate` is computed from `rejected_by` rather than
      `qa_result`, and every place rejection text is surfaced (rolling
      context block, weekly clustering corpus) tags each line with its
      source rather than merging them into generic text
- [x] No notification/email system built for the weekly review — it's a
      queryable table only, per the brief's explicit "sufficient until
      Phase 7" constraint
- [x] No review-queue UI added — `reject`/`approve` are API routes only,
      for Phase 7 to call into later
- [x] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass with
      zero errors
- [x] Manually smoke-tested with fake Supabase/Anthropic credentials (same
      approach as Phase 2/3): confirmed the reject endpoint's `400` on a
      missing/blank `reason` fires *before* any Supabase call, confirmed
      both endpoints' `404` on a nonexistent `content_item` id, confirmed
      both cron routes' `401`/`500` split (rejected before touching
      business logic on a missing/wrong `CRON_SECRET`, only failing on the
      fake Supabase connection once the secret is correct), and confirmed
      the Draft agent's new array-shaped `system` prompt (with
      `cache_control`) is accepted by the real Anthropic API (a live `401
      invalid x-api-key` response, not a client-side request-shape error)
- [ ] A real end-to-end run against live Anthropic + Supabase confirmed to
      populate a correctly-differentiated rolling rejection block and a
      real `weekly_reviews` row from live data — *pending: requires a real
      `ANTHROPIC_API_KEY` and a provisioned Supabase project; neither is
      available in this environment*

## Definition of done — Phase 5

- [x] A `content_items` row at `stage = 'assets_generated'` with
      `scheduled_at` in the past is picked up by `publish-scheduled`
      (every 15 minutes) and all three platform agents are attempted for
      it — verified by inspection of `runPublishScheduler`'s query
      (`stage = 'assets_generated' AND scheduled_at <= now()`) and its
      `Promise.allSettled` dispatch of all three agents per item; a live
      run needs real Supabase data + real platform credentials, neither
      available in this environment (see smoke test below for what *was*
      verified)
- [x] Instagram's 25/24hr rolling limit is checked (via `isRateLimited`,
      querying `posted_at >= now() - 24h`) *before* attempting a post, not
      discovered via a failed API call — same code path handles TikTok's
      15/24hr conservative ceiling
- [x] TikTok correctly branches on `TIKTOK_AUDITED` — by inspection,
      `false` never calls any TikTok API function and sets
      `status = 'ready'` logged as `success`; `true` calls
      `queryCreatorInfo`/`initVideoPublish`/`fetchPublishStatus` and uses
      the submit-then-poll state machine — *manually flipping the env var
      against a real TikTok app and confirming both branches' actual
      on-platform behavior requires a real, audited TikTok app; not
      available in this environment, see setup step 10 for the exact
      verification procedure*
- [x] Every publish attempt, success or failure, produces a
      `platform_posts` row (created on first attempt via
      `getOrCreatePlatformPost`, updated on every subsequent state
      transition) and an `agent_logs` row (every code path in all three
      publish agents ends in a `logAgentCall`, including deferrals like
      `rate_limited` and TikTok's `TIKTOK_AUDITED=false` branch) — verified
      by inspection of every return path in
      `lib/agents/pipeline/publish/{youtube,instagram,tiktok}.ts`
- [x] Token refresh crons exist for Instagram (weekly,
      `app/api/cron/refresh-ig-token`) and TikTok (daily,
      `app/api/cron/refresh-tiktok-token`), both `CRON_SECRET`-gated and
      requiring no manual intervention once `platform_tokens` is seeded —
      *confirming a real token actually rotates correctly end-to-end
      requires live Meta/TikTok credentials; not available in this
      environment*
- [x] `content_items.stage` only reaches `'published'` when every
      `platform_posts` row for that item is in a terminal state
      (`posted`/`ready`/`failed`) — `runPublishScheduler` explicitly checks
      `posts.length === 3 && posts.every(terminal)` before advancing
      `stage`, never on the first platform to succeed, and items with any
      row still `pending`/`rate_limited` are left untouched for the next
      tick
- [x] No unified third-party posting API (Ayrshare/Zapier/etc.) used —
      direct integration against each platform's own API throughout, per
      the brief's explicit constraint
- [x] No automatic retries anywhere in the publish path — every failure
      surfaces as `platform_posts.status = 'failed'` with `error_message`
      populated, for a human to investigate; confirmed by inspection (no
      retry loop exists in any of the three agents or the scheduler)
- [x] `content_items.scheduled_at` is checked before ever setting
      `privacyStatus: 'public'` on YouTube or attempting any Instagram/
      TikTok post — the scheduler's own query only ever selects items
      whose `scheduled_at` has already passed, and YouTube additionally
      re-checks it itself (`publishAt`/`privacyStatus` branch in
      `uploadVideoToYoutube`) as defense-in-depth against being called
      directly (e.g. via the standalone route) outside the scheduler
- [x] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass with
      zero errors
- [x] Manually smoke-tested with fake credentials: confirmed all three
      new cron routes' `401` on a missing/wrong `CRON_SECRET` fires before
      touching business logic; confirmed the publish routes' `400` on a
      missing `contentItemId` and graceful `500` (not a crash) against a
      fake Supabase project; and, bypassing Supabase entirely, called
      every integration wrapper function
      (`uploadVideoToYoutube`/`createReelContainer`/
      `exchangeForLongLivedToken`/`queryCreatorInfo`/
      `refreshTiktokAccessToken`/`initVideoPublish`) directly against the
      real YouTube/Meta/TikTok APIs with fake tokens — every one reached
      its real endpoint and returned a structured, provider-specific auth
      error (`invalid_client`, `OAuthException`/`Invalid OAuth access
      token`, `access_token_invalid`), confirming every request's URL,
      headers, and body shape are correct, not just that the code compiles
- [ ] A real end-to-end publish to all three platforms, including a real
      Instagram container reaching `FINISHED` and a real TikTok
      `PULL_FROM_URL` download completing, confirmed against live
      credentials — *pending: requires real YouTube OAuth credentials, a
      real Meta app + linked Instagram Business account, and a real
      (ideally already-audited) TikTok Content Posting API app; none
      available in this environment*

## Definition of done — Phase 7

- [x] The Phase 3/Phase 4 sequencing gap from section 0 is fixed —
      `lib/agents/pipeline/assets/cron.ts` now queries
      `stage = 'scheduled'` (not `'qa_passed'`), the approve endpoint sets
      `stage = 'scheduled'` and calls `runVoiceoverAgent` directly, and
      `runVoiceoverAgent` is idempotent so the direct call and the cron's
      safety-net branch can never double-generate a voiceover — verified
      by inspection of every code path involved (see "Phase 7 — Phase
      3/4/5 sequencing fix" above) and by smoke-testing the approve/
      reject/PATCH endpoints' request-shape and error-handling logic
      against a fake Supabase project (see below). *Tracing one real item
      through the full lifecycle end-to-end (research → draft → QA pass →
      approval → assets generate → publish) and confirming
      `asset_urls` stays empty until after approval requires a
      provisioned Supabase project with real Anthropic/asset-provider
      credentials; not available in this environment — see setup step 11
      for the exact manual verification procedure to run once deployed.*
- [x] The review queue lets you edit `script_text`/`platform_variants`
      inline (always-editable textareas, no separate edit mode), and both
      the new `PATCH` route and the approve/reject flow that calls it
      first (if anything changed) actually update the database — verified
      by inspection of `ReviewCard`'s `saveEditsIfDirty` → approve/reject
      sequencing and by smoke-testing `PATCH`'s validation (`400` on an
      empty body or blank `scriptText`) and its stage guard (`409`-shaped
      error path for non-`qa_passed` items, `404` for a nonexistent id)
      against a fake Supabase project
- [x] The calendar view's rate-limit headroom indicator reads
      Instagram/TikTok's exact enforced `RATE_LIMIT_CEILING` constants
      (re-exported from the Phase 5 publish agents, not duplicated) and
      counts real `platform_posts` rows per day per platform — by
      construction this can never drift from "what a manual count of
      today's `platform_posts` would show," since it's the same
      `status = 'posted'` count either way; see the Phase 7 deviations
      note above on why it's a per-calendar-day count rather than a
      true rolling 24h window
- [x] The analytics view's cost-per-post number is computed from real,
      summed `agent_logs.cost_usd` grouped by `content_item_id` and
      averaged — never hardcoded or estimated. Verified by inspection of
      the aggregation logic in `app/dashboard/analytics/page.tsx`; a real
      non-zero number requires actual pipeline runs with real API keys,
      not available in this environment
- [x] Every view handles the empty-state case gracefully — verified by
      running all three pages against a fake, unreachable Supabase
      project (every query fails with `TypeError: fetch failed`): the
      review queue and calendar both render an explicit error banner
      without crashing (and the calendar's day grid still renders fully,
      all-zero); analytics renders all three of its own per-section error
      banners independently, none of them blocking the other two
      sections' render; the dashboard layout's own auth check redirects
      to `/login` rather than throwing when `auth.getUser()` fails against
      an unreachable project. A genuinely empty-but-reachable database
      (zero rows, no error) hits the same empty-state branches (`items.
      length === 0`, `perItemCosts.length === 0`, etc.), which were
      exercised directly via code inspection of every such branch, since
      a real empty-but-connected Supabase project isn't available in this
      environment either.
- [x] No charting library dependency was added — `package.json` is
      unchanged from Phase 5; `app/dashboard/analytics/charts.tsx` is
      ~100 lines of hand-rolled SVG
- [x] No user/role management added — the dashboard layout's auth check
      is the same single-user `auth.getUser()` pattern used since Phase 0
- [x] `npx tsc --noEmit`, `npx eslint .`, and `npm run build` all pass with
      zero errors
- [x] Manually smoke-tested with a fake Supabase project (`https://fake-
      project-ref.supabase.co`) and `proxy.ts` temporarily disabled (same
      approach as every earlier phase): confirmed `PATCH
      /api/content-items/[id]`'s `400`s fire before any Supabase call
      (empty body, blank `scriptText`), confirmed it and the approve/
      reject endpoints all return a graceful `404` (not a crash) once
      they reach the fake, unreachable project; confirmed
      `check-renders`' `401`/`500` split is unchanged after the stage-
      query edit; confirmed all three new dashboard pages return `200`
      and render their respective error/empty states (not a 500) against
      the same fake project, both under normal auth (redirects to
      `/login`, proving the layout's auth check doesn't itself crash on a
      network failure) and with auth temporarily bypassed to inspect the
      page bodies directly
- [ ] A real end-to-end trace through the full lifecycle against a live
      Supabase project with real content — confirming assets genuinely
      don't start generating until after a human clicks Approve, that the
      calendar/analytics numbers match a manual count of real rows, and
      that the empty-state and populated-state UI both look right with
      actual browser rendering (not just server-rendered HTML inspected
      via `curl`) — *pending: requires a provisioned Supabase project,
      real Anthropic/asset-provider credentials, and ideally a real
      browser session; none available in this environment*
