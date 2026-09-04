-- Permite a la admin marcar a una vendedora como "de baja prioridad" (ej:
-- fotos de mala calidad) para que sus prendas siempre aparezcan al final
-- del catálogo, sin importar el orden elegido (recientes, precio, etc.) ni
-- que la vendedora use "Renovar" para intentar subir su prenda.
--
-- profiles.deprioritized es la fuente de verdad (toggleable desde
-- /admin/users/[id]). listings.seller_deprioritized es una copia
-- denormalizada para poder ordenar el catálogo con un simple ORDER BY —
-- evita depender de ordenar por una columna de una tabla embebida via
-- PostgREST, que es fragil. Se mantiene sincronizada con dos triggers:
-- uno al crear/reasignar una prenda, otro al cambiar el flag de la
-- vendedora (cascada a todas sus prendas existentes).
alter table public.profiles add column if not exists deprioritized boolean not null default false;
alter table public.listings add column if not exists seller_deprioritized boolean not null default false;
create index if not exists listings_seller_deprioritized_idx on public.listings (seller_deprioritized);

create or replace function public.sync_listing_seller_deprioritized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select deprioritized into new.seller_deprioritized from public.profiles where id = new.seller_id;
  return new;
end;
$$;

drop trigger if exists listings_sync_seller_deprioritized on public.listings;
create trigger listings_sync_seller_deprioritized
  before insert or update of seller_id on public.listings
  for each row execute function public.sync_listing_seller_deprioritized();

create or replace function public.cascade_seller_deprioritized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.deprioritized is distinct from old.deprioritized then
    update public.listings set seller_deprioritized = new.deprioritized where seller_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_cascade_deprioritized on public.profiles;
create trigger profiles_cascade_deprioritized
  after update of deprioritized on public.profiles
  for each row execute function public.cascade_seller_deprioritized();
