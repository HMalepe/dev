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
- **Phase 3** (asset pipeline): takes a `qa_passed` content item and
  produces a finished long-form video, a vertical short with burned-in
  captions, and a thumbnail — narration via ElevenLabs, assembly via
  Shotstack (submit-then-poll-via-cron, never synchronous), optional
  non-identifying B-roll via Kling, generic imagery via Pexels, automated
  QA on every output, landing at `stage = 'assets_generated'`. No platform
  publishing (Phase 5) or dashboard review UI (Phase 7) yet.
- **Phase 4** (feedback loop): captures manual (human) rejections with the
  same rigor QA-agent rejections already get, builds a rolling "recently
  rejected, avoid these patterns" block injected into the Draft agent's
  system prompt (with Anthropic prompt caching on both that block and the
  rubric), and a weekly cron snapshot (`weekly_reviews`) tracking whether
  QA pass rate is actually improving. No review-queue UI (Phase 7) — this
  phase only builds the capture/feedback logic that UI will call into.

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
  logic behind the cron route. Per content item, per tick: resolve any
  pending Kling jobs → submit the main render once they're all resolved →
  poll the main render → poll the vertical render → run asset QA once all
  three asset URLs exist. Downloads finished renders from Shotstack's
  temporary URL and re-uploads to the `rendered-videos` Supabase Storage
  bucket ("don't leave production assets solely dependent on a third-party
  CDN link"). A `failed` render leaves `stage` untouched so it surfaces as
  stuck rather than disappearing.
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
  research → draft → qa internal-chaining pattern.
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
  (`qa_passed` or `assets_generated`) before allowing the transition (409
  otherwise) — see "Deviations".
- `app/api/content-items/[id]/approve/route.ts` — companion endpoint,
  `POST` with no body, sets `stage = 'scheduled'`. Same stage guard as
  reject. Doesn't touch `rejected_by`/`rejection_reason` — it doesn't
  generate feedback-loop data itself, per the brief.
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

## One-time manual setup

These steps require your own Supabase and Vercel accounts/credentials and
can't be done from an automated agent session — do them once, yourself:

### 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_feedback_loop.sql`, in that order, via either:
   - **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`, or
   - **Dashboard SQL editor:** paste the contents of each migration file and run it.
3. Confirm the tables exist (Table Editor, or
   `select table_name from information_schema.tables where table_schema = 'public';`)
   — you should see `content_items`, `platform_posts`, `agent_logs`, and
   (after 0002) `weekly_reviews`.
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

Leave the YouTube/Instagram/TikTok publishing variables blank for now —
they're placeholders for Phase 4/5.

### 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you should be redirected to `/login`. Sign
in with the user you created in step 1 and you should land on `/dashboard`.

### 4. Deploy

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Import the repo into a new Vercel project.
3. Add every variable from `.env.local.example` to Vercel's Project Settings
   → Environment Variables, for both **Production** and **Preview**.
4. Deploy, then confirm the deployed URL loads `/login` and, after signing
   in, reaches `/dashboard`.

### 5. Run the Phase 1 QA calibration

With `ANTHROPIC_API_KEY` set in `.env.local`:

```bash
npm run qa:calibrate
```

This runs 10 compliant + 10 non-compliant fictional scripts
(`qa-calibration/`) through the QA agent and reports whether its verdicts
match `qa-calibration/manifest.json`'s expectations. Per
`docs/brand-voice-qa-rubric.md`, the QA agent should not be wired into any
live route until this passes consistently.

### 6. Run the Phase 2 pipeline

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

### 7. Run the Phase 3 asset pipeline

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

### 8. Exercise the Phase 4 feedback loop

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
- **Both the reject and approve endpoints guard that the item is at `stage
  = 'qa_passed'` or `stage = 'assets_generated'`** (409 otherwise), beyond
  the brief's literal minimum-viable spec. "Something that already passed
  automated QA" (the brief's own description of what this endpoint is for)
  covers both stages in this codebase, since Phase 3 only ever generates
  assets for an item that already passed QA — rejecting/approving anything
  earlier in the pipeline (e.g. `researched`, `scripted`) would mean the
  review queue is calling these out of order.
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
