create table if not exists public.hub_profiles (
  id text primary key,
  avatar_url text,
  updated_by text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hub_profiles
  add column if not exists name text,
  add column if not exists role text,
  add column if not exists pin_hash text,
  add column if not exists last_device_id text,
  add column if not exists last_pin_validation_at timestamptz,
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists failed_pin_attempts integer not null default 0,
  add column if not exists pin_locked_until timestamptz;

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

drop trigger if exists hub_profiles_updated_at on public.hub_profiles;
create trigger hub_profiles_updated_at
before update on public.hub_profiles
for each row execute function public.set_hub_updated_at();

alter table public.hub_profiles enable row level security;
drop policy if exists "pilot_read_profiles" on public.hub_profiles;
create policy "pilot_read_profiles" on public.hub_profiles for select to anon, authenticated using (true);
drop policy if exists "pilot_update_profiles" on public.hub_profiles;
create policy "pilot_update_profiles" on public.hub_profiles for update to anon, authenticated using (true) with check (true);

insert into public.hub_profiles (id, name, role, updated_by)
values
  ('david', 'David', 'Direction', 'system'),
  ('zacharie', 'Zac', 'Direction', 'system'),
  ('valerie', 'Valérie', 'Direction', 'system'),
  ('steven', 'Steven', 'Staff', 'system'),
  ('theo', 'Théo', 'Staff', 'system')
on conflict (id) do update set name = excluded.name, role = excluded.role;

alter table public.hub_tasks
  add column if not exists assigned_to text,
  add column if not exists assigned_by text,
  add column if not exists status text,
  add column if not exists reminder_mode text not null default 'none',
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists last_reminder_at timestamptz;

update public.hub_tasks
set
  assigned_to = coalesce(data->>'assignedTo', data->>'assignee', assigned_to),
  assigned_by = coalesce(data->>'assignedBy', data->>'createdBy', assigned_by),
  status = coalesce(data->>'status', status),
  reminder_mode = coalesce(data->>'reminderMode', reminder_mode, 'none'),
  reminder_enabled = case
    when data->>'reminderEnabled' in ('true', 'false') then (data->>'reminderEnabled')::boolean
    else coalesce(reminder_enabled, false)
  end
where coalesce(data->>'kind', '') <> 'profile';

revoke select on public.hub_profiles from anon, authenticated;
grant select (id, name, role, avatar_url, notifications_enabled, updated_at) on public.hub_profiles to anon, authenticated;
revoke insert, update on public.hub_profiles from anon, authenticated;
grant update (avatar_url, updated_by) on public.hub_profiles to anon, authenticated;

alter table public.hub_profiles replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.hub_profiles;
exception when duplicate_object then null;
end $$;
