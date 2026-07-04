# Content Pipeline — Phase 0 (Foundation Scaffold)

This is Phase 0 of the SA/African true crime AI content pipeline: infrastructure
only. There is **no agent logic, no content generation, and no publishing code**
yet — just a deployed, authenticated empty shell that later phases build on.

Single user, forever. No teams, roles, or multi-tenant anything.

## Stack

- **Framework:** Next.js (App Router, TypeScript strict mode)
- **Styling:** Tailwind CSS
- **Backend/DB:** Supabase (Postgres + Auth)
- **Hosting:** Vercel

## What exists today

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
`SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API. Leave every other
variable in the file blank for now — they're placeholders for later phases
(Claude agents, YouTube/Instagram/TikTok publishing, ElevenLabs/Kling asset
generation) so you only have to discover and fill them in once.

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

No other deviations were made. The database schema, RLS policies, and env
var list match the brief exactly.

## Definition of done (from the task brief)

- [x] `npm run build` succeeds with zero TypeScript errors
- [ ] All 3 tables exist in Supabase with RLS enabled and policies applied — *pending: requires running the migration against your own Supabase project (see step 1 above)*
- [ ] Login flow works end-to-end on the deployed Vercel URL — *pending: requires your own Vercel deployment (see step 4 above)*
- [x] `.env.local` is gitignored and never appears in any commit
- [x] `.env.local.example` is committed and lists every variable through Phase 7
- [x] No agent/generation/publishing code exists yet
