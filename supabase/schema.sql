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
  assigned_to text,
  assigned_by text,
  status text,
  reminder_mode text not null default 'none',
  reminder_enabled boolean not null default false,
  last_reminder_at timestamptz,
  completed_at timestamptz,
  validated_at timestamptz,
  retrieved_at timestamptz,
  delivered_at timestamptz,
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

create table if not exists public.hub_profiles (
  id text primary key,
  name text,
  role text,
  avatar_url text,
  pin_hash text,
  last_device_id text,
  last_pin_validation_at timestamptz,
  notifications_enabled boolean not null default false,
  failed_pin_attempts integer not null default 0,
  pin_locked_until timestamptz,
  updated_by text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.address_book (
  id text primary key,
  first_name text,
  last_name text,
  company text,
  phone text,
  address text,
  address_extra text,
  postal_code text,
  city text,
  access_code text,
  floor text,
  has_elevator boolean,
  delivery_instructions text,
  internal_notes text,
  created_by text not null default 'unknown',
  updated_by text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists address_book_city_idx on public.address_book (city);
create index if not exists address_book_archived_at_idx on public.address_book (archived_at);

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

drop trigger if exists hub_profiles_updated_at on public.hub_profiles;
create trigger hub_profiles_updated_at
before update on public.hub_profiles
for each row execute function public.set_hub_updated_at();

drop trigger if exists stuart_oauth_tokens_updated_at on public.stuart_oauth_tokens;
create trigger stuart_oauth_tokens_updated_at
before update on public.stuart_oauth_tokens
for each row execute function public.set_hub_updated_at();

drop trigger if exists address_book_updated_at on public.address_book;
create trigger address_book_updated_at
before update on public.address_book
for each row execute function public.set_hub_updated_at();

alter table public.hub_tasks enable row level security;
alter table public.hub_activity enable row level security;
alter table public.hub_profiles enable row level security;
alter table public.stuart_oauth_tokens enable row level security;
alter table public.stuart_api_logs enable row level security;
alter table public.address_book enable row level security;

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

drop policy if exists "pilot_read_profiles" on public.hub_profiles;
create policy "pilot_read_profiles" on public.hub_profiles for select to anon, authenticated using (true);
drop policy if exists "pilot_write_profiles" on public.hub_profiles;
create policy "pilot_write_profiles" on public.hub_profiles for insert to anon, authenticated with check (true);
drop policy if exists "pilot_update_profiles" on public.hub_profiles;
create policy "pilot_update_profiles" on public.hub_profiles for update to anon, authenticated using (true) with check (true);

insert into public.hub_profiles (id, name, role, updated_by)
values ('david','David','Direction','system'), ('zacharie','Zac','Direction','system'), ('valerie','Valérie','Direction','system'), ('steven','Steven','Staff','system'), ('theo','Théo','Staff','system')
on conflict (id) do update set name = excluded.name, role = excluded.role;

revoke select on public.hub_profiles from anon, authenticated;
grant select (id, name, role, avatar_url, notifications_enabled, updated_at) on public.hub_profiles to anon, authenticated;
revoke insert, update on public.hub_profiles from anon, authenticated;
grant update (avatar_url, updated_by) on public.hub_profiles to anon, authenticated;

revoke all on public.stuart_oauth_tokens from anon, authenticated;
revoke all on public.stuart_api_logs from anon, authenticated;

drop policy if exists "pilot_read_address_book" on public.address_book;
create policy "pilot_read_address_book" on public.address_book for select to anon, authenticated using (true);
drop policy if exists "pilot_write_address_book" on public.address_book;
create policy "pilot_write_address_book" on public.address_book for insert to anon, authenticated with check (true);
drop policy if exists "pilot_update_address_book" on public.address_book;
create policy "pilot_update_address_book" on public.address_book for update to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pilot_read_avatars" on storage.objects;
create policy "pilot_read_avatars" on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists "pilot_upload_avatars" on storage.objects;
create policy "pilot_upload_avatars" on storage.objects for insert to anon, authenticated with check (bucket_id = 'avatars');
drop policy if exists "pilot_update_avatars" on storage.objects;
create policy "pilot_update_avatars" on storage.objects for update to anon, authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

alter table public.hub_tasks replica identity full;
alter table public.hub_activity replica identity full;
alter table public.hub_profiles replica identity full;
alter table public.address_book replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.hub_tasks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.hub_profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.hub_activity;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.address_book;
exception when duplicate_object then null;
end $$;
