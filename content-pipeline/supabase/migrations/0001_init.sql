-- Core content lifecycle
create table content_items (
  id uuid primary key default gen_random_uuid(),
  case_title text not null,
  case_region text,
  source_urls jsonb default '[]',
  stage text not null default 'researched'
    check (stage in ('researched','scripted','qa_pending','qa_passed','qa_rejected','assets_generated','scheduled','published','archived')),
  script_text text,
  platform_variants jsonb default '{}',
  qa_score jsonb,
  qa_result text check (qa_result in ('pass','fail')),
  rejection_reason text,
  compliance_flags jsonb default '{}',
  asset_urls jsonb default '{}',
  scheduled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Per-platform publish tracking
create table platform_posts (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  platform text not null check (platform in ('youtube','instagram','tiktok')),
  status text not null default 'pending'
    check (status in ('pending','ready','posted','failed','rate_limited')),
  platform_post_id text,
  posted_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);

-- Agent audit trail / cost tracking
create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  agent_name text not null check (agent_name in ('research','draft','qa','asset','publish')),
  model_used text not null,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10,6),
  status text not null check (status in ('success','fail','retry')),
  output_summary text,
  created_at timestamptz default now()
);

create index idx_content_items_stage on content_items(stage);
create index idx_platform_posts_content_item on platform_posts(content_item_id);
create index idx_agent_logs_content_item on agent_logs(content_item_id);

-- RLS: enable on all tables, single owner (the authenticated user) has full access
alter table content_items enable row level security;
alter table platform_posts enable row level security;
alter table agent_logs enable row level security;

-- Since this is single-user, policy is simply "authenticated users can do everything"
-- (there is exactly one user account; this is not a security gap for this use case)
create policy "authenticated full access" on content_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on platform_posts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on agent_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
