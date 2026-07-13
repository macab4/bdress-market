-- ============================================================
-- Bdress Market — Schema inicial
-- Pegar en Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Perfiles (extiende auth.users de Supabase)
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  name        text not null default '',
  avatar_url  text,
  city        text,
  bio         text,
  created_at  timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Perfiles visibles para todos" on public.profiles
  for select using (true);

create policy "Usuario edita su propio perfil" on public.profiles
  for update using (auth.uid() = id);

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Prendas
create table public.listings (
  id            uuid default gen_random_uuid() primary key,
  seller_id     uuid references public.profiles(id) on delete cascade not null,
  title         text not null,
  description   text not null default '',
  category      text not null check (category in ('mujer','hombre','ninos')),
  subcategory   text not null default '',
  size          text not null,
  brand         text not null default '',
  condition     text not null check (condition in ('nuevo_con_etiquetas','nuevo_sin_etiquetas','muy_bueno','bueno','satisfactorio')),
  shipping_size text not null default 'mediano' check (shipping_size in ('pequeno','mediano','grande')),
  price         integer not null check (price > 0),
  photos        text[] not null default '{}',
  status        text not null default 'active' check (status in ('active','sold','paused')),
  created_at    timestamptz default now()
);
alter table public.listings enable row level security;

create policy "Prendas activas visibles para todos" on public.listings
  for select using (status = 'active' or seller_id = auth.uid());

create policy "Vendedora crea sus prendas" on public.listings
  for insert with check (auth.uid() = seller_id);

create policy "Vendedora edita sus prendas" on public.listings
  for update using (auth.uid() = seller_id);

-- Órdenes
create table public.orders (
  id              uuid default gen_random_uuid() primary key,
  listing_id      uuid references public.listings(id) not null,
  buyer_id        uuid references public.profiles(id) not null,
  seller_id       uuid references public.profiles(id) not null,
  amount          integer not null,
  commission      integer not null,
  status          text not null default 'pending_payment'
                    check (status in ('pending_payment','paid','shipped','delivered','completed','disputed','cancelled')),
  tracking_number text,
  flow_order_id   text,
  created_at      timestamptz default now()
);
alter table public.orders enable row level security;

create policy "Orden visible para compradora y vendedora" on public.orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Compradora crea orden" on public.orders
  for insert with check (auth.uid() = buyer_id);

create policy "Vendedora actualiza estado de envío" on public.orders
  for update using (auth.uid() = seller_id or auth.uid() = buyer_id);

-- Mensajes
create table public.messages (
  id          uuid default gen_random_uuid() primary key,
  sender_id   uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  listing_id  uuid references public.listings(id) not null,
  content     text not null,
  created_at  timestamptz default now()
);
alter table public.messages enable row level security;

create policy "Mensajes visibles para sender y receiver" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Usuario envía mensajes" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Reseñas
create table public.reviews (
  id           uuid default gen_random_uuid() primary key,
  reviewer_id  uuid references public.profiles(id) not null,
  reviewed_id  uuid references public.profiles(id) not null,
  order_id     uuid references public.orders(id) not null unique,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz default now()
);
alter table public.reviews enable row level security;

create policy "Reseñas visibles para todos" on public.reviews
  for select using (true);

create policy "Usuario deja reseña de su orden" on public.reviews
  for insert with check (auth.uid() = reviewer_id);

-- Storage bucket para fotos de prendas
insert into storage.buckets (id, name, public) values ('listings', 'listings', true);

create policy "Fotos públicas" on storage.objects
  for select using (bucket_id = 'listings');

create policy "Usuaria sube sus fotos" on storage.objects
  for insert with check (bucket_id = 'listings' and auth.uid() is not null);

create policy "Usuaria borra sus fotos" on storage.objects
  for delete using (bucket_id = 'listings' and auth.uid() is not null);
