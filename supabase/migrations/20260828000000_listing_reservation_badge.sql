-- "Reservado" visible para la compradora en la ficha de producto — hoy el
-- hold de create_or_reuse_pending_order (supabase-schema.sql) es puramente
-- interno: nadie ve que una prenda activa tiene una orden pending_payment en
-- curso hasta que intenta comprarla y le sale el error
-- "listing_reserved_by_other_buyer" en payment/create. Esta función expone
-- solo el dato mínimo seguro (cuántos minutos quedan de hold, sin revelar
-- quién la reservó) para poder mostrar un badge en la ficha pública sin
-- necesitar el cliente service-role ni tocar la policy de select de
-- orders (que sigue restringida a compradora/vendedora).
--
-- 30 minutos hardcodeado acá porque SQL no puede importar
-- PENDING_ORDER_EXPIRY_MINUTES de src/lib/catalog.ts — mismo plazo que usa
-- create_or_reuse_pending_order para expirar el hold, mantenerlos en sync
-- si alguna vez cambia ese número.
create or replace function public.listing_reservation_minutes_left(p_listing_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select greatest(1, ceil(extract(epoch from (created_at + interval '30 minutes' - now())) / 60))::integer
  from public.orders
  where listing_id = p_listing_id
    and status = 'pending_payment'
    and created_at > now() - interval '30 minutes'
  limit 1
$$;

grant execute on function public.listing_reservation_minutes_left(uuid) to anon, authenticated;
