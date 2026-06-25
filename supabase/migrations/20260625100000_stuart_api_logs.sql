create table if not exists public.stuart_oauth_tokens (
  provider text primary key default 'stuart',
  access_token text not null,
  token_type text not null default 'Bearer',
  scope text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stuart_api_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  task_id text,
  ok boolean not null default false,
  status_code integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create index if not exists stuart_api_logs_task_id_idx on public.stuart_api_logs (task_id);
create index if not exists stuart_api_logs_created_at_idx on public.stuart_api_logs (created_at desc);

drop trigger if exists stuart_oauth_tokens_updated_at on public.stuart_oauth_tokens;
create trigger stuart_oauth_tokens_updated_at
before update on public.stuart_oauth_tokens
for each row execute function public.set_hub_updated_at();

alter table public.stuart_oauth_tokens enable row level security;
alter table public.stuart_api_logs enable row level security;

-- These tables are server-only. Supabase Edge Functions use the service role key.
revoke all on public.stuart_oauth_tokens from anon, authenticated;
revoke all on public.stuart_api_logs from anon, authenticated;
