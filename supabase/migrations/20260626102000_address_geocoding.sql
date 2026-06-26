alter table public.address_book
  add column if not exists country text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists address_label text,
  add column if not exists address_selected boolean not null default false;
