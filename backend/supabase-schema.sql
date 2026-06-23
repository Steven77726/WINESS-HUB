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

create table if not exists public.hub_tasks (
  id text primary key,
  data jsonb not null,
  updated_by text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hub_activity (
  id text primary key,
  event_time text not null,
  text text not null,
  created_by text not null default 'unknown',
  created_at timestamptz not null default now()
);

create or replace function public.set_hub_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hub_tasks_updated_at on public.hub_tasks;
create trigger hub_tasks_updated_at
before update on public.hub_tasks
for each row execute function public.set_hub_updated_at();

alter table public.hub_tasks enable row level security;
alter table public.hub_activity enable row level security;

-- Mode pilote sans compte utilisateur. A remplacer par des règles Supabase Auth
-- avant de stocker des informations clients sensibles.
drop policy if exists "pilot_read_tasks" on public.hub_tasks;
create policy "pilot_read_tasks" on public.hub_tasks for select to anon, authenticated using (true);
drop policy if exists "pilot_write_tasks" on public.hub_tasks;
create policy "pilot_write_tasks" on public.hub_tasks for insert to anon, authenticated with check (true);
drop policy if exists "pilot_update_tasks" on public.hub_tasks;
create policy "pilot_update_tasks" on public.hub_tasks for update to anon, authenticated using (true) with check (true);

drop policy if exists "pilot_read_activity" on public.hub_activity;
create policy "pilot_read_activity" on public.hub_activity for select to anon, authenticated using (true);
drop policy if exists "pilot_write_activity" on public.hub_activity;
create policy "pilot_write_activity" on public.hub_activity for insert to anon, authenticated with check (true);

alter table public.hub_tasks replica identity full;
alter table public.hub_activity replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.hub_tasks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.hub_activity;
exception when duplicate_object then null;
end $$;
