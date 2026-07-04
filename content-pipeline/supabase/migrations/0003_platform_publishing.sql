-- Phase 5: platform publishing (YouTube, Instagram, TikTok).

-- Durable storage for refreshed OAuth tokens (Instagram's weekly
-- long-lived-token exchange, TikTok's daily access-token refresh), per the
-- brief's own suggestion: "a small table (platform, token, expires_at) is
-- cleaner than mutating Vercel env vars from code." refresh_token is only
-- ever populated for TikTok (its 24h-access/365-day-refresh model needs
-- both stored; Instagram's fb_exchange_token flow only ever needs the
-- current access token itself, no separate refresh token).
create table platform_tokens (
  platform text primary key check (platform in ('instagram','tiktok')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

alter table platform_tokens enable row level security;
create policy "authenticated full access" on platform_tokens
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Reuses the set_updated_at() trigger function defined in
-- 0002_feedback_loop.sql.
create trigger platform_tokens_set_updated_at
  before update on platform_tokens
  for each row
  execute function set_updated_at();

-- Instagram container IDs and TikTok publish_ids are intermediate,
-- in-flight job identifiers -- distinct from platform_posts.platform_post_id,
-- which is reserved for the final, published post's ID once a platform_posts
-- row reaches a terminal state. Storing the in-flight id separately lets a
-- later publish-scheduled cron tick resume polling an already-submitted
-- container/publish job instead of submitting a duplicate one -- the same
-- submit-then-poll-via-cron discipline Phase 3 established for Shotstack
-- renders and Kling B-roll jobs, applied here to Instagram/TikTok's own
-- asynchronous publish flows.
alter table platform_posts add column provider_job_id text;
