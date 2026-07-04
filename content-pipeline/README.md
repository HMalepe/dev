# Content Pipeline

The SA/African true crime AI content pipeline. Single user, forever — no
teams, roles, or multi-tenant anything.

- **Phase 0** (infrastructure): a deployed, authenticated empty shell —
  no agent logic, no content generation, no publishing code.
- **Phase 1** (brand voice & QA rubric): the persona spec and a QA agent
  that scores drafts against it, calibrated against known-good/known-bad
  scripts before it's trusted with anything real. Still no draft/research/
  publish agents, and QA itself is not yet wired into any live route.

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
`ANTHROPIC_API_KEY` if you want to run the Phase 1 QA agent/calibration
(get one from the [Anthropic Console](https://console.anthropic.com)).
Leave every other variable in the file blank for now — they're placeholders
for later phases (YouTube/Instagram/TikTok publishing, ElevenLabs/Kling
asset generation) so you only have to discover and fill them in once.

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
