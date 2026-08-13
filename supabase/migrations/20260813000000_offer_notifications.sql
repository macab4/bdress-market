-- La tabla notifications estaba definida en supabase-schema.sql pero nunca
-- se corrió en producción — por eso nunca llegó ninguna notificación in-app
-- (ni siquiera "nueva prenda de alguien que sigues"). Este script la crea
-- si falta y agrega la política de insert que necesitan las notificaciones
-- de ofertas (que se insertan directo desde las rutas de API, no vía
-- trigger). Es seguro correrlo aunque partes ya existan.

create table if not exists public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text not null default 'new_listing',
  actor_id    uuid references public.profiles(id) on delete cascade not null,
  listing_id  uuid references public.listings(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
create index if not exists notifications_user_id_idx on public.notifications (user_id);

drop policy if exists "Usuaria ve sus notificaciones" on public.notifications;
create policy "Usuaria ve sus notificaciones" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Usuaria marca sus notificaciones como leidas" on public.notifications;
create policy "Usuaria marca sus notificaciones como leidas" on public.notifications
  for update using (auth.uid() = user_id);

drop policy if exists "Usuaria crea notificación como actor" on public.notifications;
create policy "Usuaria crea notificación como actor" on public.notifications
  for insert with check (auth.uid() = actor_id);

create or replace function public.notify_followers_new_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.notifications (user_id, type, actor_id, listing_id)
    select follower_id, 'new_listing', new.seller_id, new.id
    from public.follows
    where followed_id = new.seller_id;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_notify_followers on public.listings;
create trigger listings_notify_followers
  after insert or update of status on public.listings
  for each row execute function public.notify_followers_new_listing();
