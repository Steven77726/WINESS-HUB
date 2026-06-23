create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null unique,
  keys jsonb not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create table if not exists public.push_notification_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  user_id text not null,
  title text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_notification_events_created_at_idx on public.push_notification_events (created_at);
alter table public.push_notification_events enable row level security;
