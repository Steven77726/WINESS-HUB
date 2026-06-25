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

drop trigger if exists address_book_updated_at on public.address_book;
create trigger address_book_updated_at
before update on public.address_book
for each row execute function public.set_hub_updated_at();

alter table public.address_book enable row level security;

drop policy if exists "pilot_read_address_book" on public.address_book;
create policy "pilot_read_address_book" on public.address_book for select to anon, authenticated using (true);

drop policy if exists "pilot_write_address_book" on public.address_book;
create policy "pilot_write_address_book" on public.address_book for insert to anon, authenticated with check (true);

drop policy if exists "pilot_update_address_book" on public.address_book;
create policy "pilot_update_address_book" on public.address_book for update to anon, authenticated using (true) with check (true);

alter table public.address_book replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.address_book;
exception when duplicate_object then null;
end $$;
