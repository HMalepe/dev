-- Phase 4: feedback loop (manual rejection capture, rolling rejection
-- context for the Draft agent, weekly QA-effectiveness snapshots).

alter table content_items add column rejected_by text check (rejected_by in ('qa_agent','human'));

-- Section 2's note: rejected_by distinguishes whether content_items.
-- qa_result = 'fail' (or a qa_result = 'pass' item later pulled back to
-- stage = 'qa_rejected') came from the Phase 2 QA agent or from a human
-- rejecting something that already passed automated QA. These are kept
-- strictly separate everywhere downstream (rolling context block, weekly
-- stats) -- see lib/getRecentRejections.ts and
-- lib/agents/pipeline/weeklyReview.ts.

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  items_processed integer,
  qa_pass_rate numeric(5,2),
  human_approval_rate numeric(5,2),
  prior_week_qa_pass_rate numeric(5,2),
  top_rejection_themes jsonb,
  created_at timestamptz default now()
);

alter table weekly_reviews enable row level security;
create policy "authenticated full access" on weekly_reviews
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- The weekly review job (and the rolling rejection context block) both
-- order/filter by content_items.updated_at to find "what happened this
-- week" / "most recently rejected". Nothing in 0001_init.sql ever actually
-- refreshed updated_at on UPDATE (it only defaulted on INSERT), so every
-- row's updated_at was frozen at creation time -- silently wrong once you
-- depend on it for recency, which Phase 4 is the first phase to do. Fixing
-- this here since it's now load-bearing.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_items_set_updated_at
  before update on content_items
  for each row
  execute function set_updated_at();

-- New agent_logs.agent_name value for the weekly clustering (Haiku) call --
-- doesn't fit research/draft/qa/asset/publish, and the brief is explicit
-- that this call must still be logged like any other (section 5.5).
alter table agent_logs drop constraint agent_logs_agent_name_check;
alter table agent_logs add constraint agent_logs_agent_name_check
  check (agent_name in ('research','draft','qa','asset','publish','weekly_review'));
