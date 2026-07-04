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

## One-time manual setup

These steps require your own Supabase and Vercel accounts/credentials and
can't be done from an automated agent session — do them once, yourself:

### 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Apply the schema in `supabase/migrations/0001_init.sql` via either:
   - **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`, or
   - **Dashboard SQL editor:** paste the contents of the migration file and run it.
3. Confirm the three tables exist (Table Editor, or
   `select table_name from information_schema.tables where table_schema = 'public';`).
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
[Anthropic Console](https://console.anthropic.com)). Leave every other
variable in the file blank for now — they're placeholders for later phases
(YouTube/Instagram/TikTok publishing, ElevenLabs/Kling asset generation) so
you only have to discover and fill them in once.

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
