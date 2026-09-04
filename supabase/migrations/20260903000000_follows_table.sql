-- La tabla follows (seguir vendedoras) estaba definida en
-- supabase-schema.sql pero, a diferencia de notifications, nunca tuvo su
-- propia migración — nunca se corrió en producción. Eso rompió el botón de
-- seguir vendedoras desde siempre, y además rompió publicar prendas nuevas
-- desde que se agregó el trigger notify_followers_new_listing (que lee de
-- esta tabla): "relation public.follows does not exist" al insertar en
-- listings. Es seguro correrlo aunque partes ya existan.

create table if not exists public.follows (
  id           uuid default gen_random_uuid() primary key,
  follower_id  uuid references public.profiles(id) on delete cascade not null,
  followed_id  uuid references public.profiles(id) on delete cascade not null,
  created_at   timestamptz default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);
alter table public.follows enable row level security;

drop policy if exists "Cualquiera ve relaciones de seguimiento" on public.follows;
create policy "Cualquiera ve relaciones de seguimiento" on public.follows
  for select using (true);

drop policy if exists "Usuaria sigue a otra" on public.follows;
create policy "Usuaria sigue a otra" on public.follows
  for insert with check (auth.uid() = follower_id);

drop policy if exists "Usuaria deja de seguir" on public.follows;
create policy "Usuaria deja de seguir" on public.follows
  for delete using (auth.uid() = follower_id);
