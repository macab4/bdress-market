-- Catch-up idempotente: estos fragmentos quedaron escritos en
-- supabase-schema.sql en su momento pero, a diferencia de las secciones
-- posteriores (que citan explícitamente "Mismo contenido que
-- supabase/migrations/X.sql"), nunca tuvieron su propio archivo de
-- migración — mismo patrón que rompió notifications y follows. No hay
-- forma de confirmar desde el código si cada pieza ya corrió en
-- producción o no, así que todo acá es 100% aditivo e idempotente
-- (IF NOT EXISTS / DROP POLICY IF EXISTS) para que sea seguro correrlo
-- sin importar el estado actual. Deliberadamente NO incluye el fix de
-- "hasta 2 colores por prenda" (listings.colors) porque ese sí incluye
-- un drop column destructivo y ya se confirmó que corrió en prod.

alter table public.profiles add column if not exists legacy_seller boolean not null default false;

alter table public.message_flags add column if not exists reviewed_at timestamptz;

alter table public.listings add column if not exists bumped_at timestamptz not null default now();
alter table public.listings add column if not exists featured_until timestamptz;

create table if not exists public.listing_boosts (
  id           uuid default gen_random_uuid() primary key,
  listing_id   uuid references public.listings(id) on delete cascade not null,
  seller_id    uuid references public.profiles(id) on delete cascade not null,
  amount       integer not null check (amount > 0),
  status       text not null default 'pending_payment' check (status in ('pending_payment','paid','cancelled')),
  payment_ref  text,
  created_at   timestamptz default now(),
  paid_at      timestamptz
);
alter table public.listing_boosts enable row level security;

drop policy if exists "Vendedora ve sus boosts" on public.listing_boosts;
create policy "Vendedora ve sus boosts" on public.listing_boosts
  for select using (auth.uid() = seller_id);

drop policy if exists "Vendedora crea sus boosts" on public.listing_boosts;
create policy "Vendedora crea sus boosts" on public.listing_boosts
  for insert with check (auth.uid() = seller_id);

alter table public.listings add column if not exists product_category text;
alter table public.listings add column if not exists product_type text;
alter table public.listings add column if not exists length text;
alter table public.listings add column if not exists occasion text[] not null default '{}';
alter table public.listings add column if not exists season text;
alter table public.listings add column if not exists style text;
alter table public.listings add column if not exists material text;
alter table public.listings add column if not exists pending_review boolean not null default false;

create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_product_category_idx on public.listings (product_category);
create index if not exists listings_product_type_idx on public.listings (product_type);
create index if not exists listings_brand_idx on public.listings (brand);
create index if not exists listings_size_idx on public.listings (size);
create index if not exists listings_status_idx on public.listings (status);
create index if not exists listings_price_idx on public.listings (price);
create index if not exists listings_bumped_at_idx on public.listings (bumped_at);

create table if not exists public.saved_searches (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  label      text,
  params     text not null,
  created_at timestamptz default now()
);
alter table public.saved_searches enable row level security;

drop policy if exists "Usuaria ve sus búsquedas guardadas" on public.saved_searches;
create policy "Usuaria ve sus búsquedas guardadas" on public.saved_searches
  for select using (auth.uid() = user_id);

drop policy if exists "Usuaria guarda una búsqueda" on public.saved_searches;
create policy "Usuaria guarda una búsqueda" on public.saved_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "Usuaria elimina su búsqueda guardada" on public.saved_searches;
create policy "Usuaria elimina su búsqueda guardada" on public.saved_searches
  for delete using (auth.uid() = user_id);

alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists buyer_review_reminded_at timestamptz;
alter table public.orders add column if not exists seller_review_reminded_at timestamptz;
