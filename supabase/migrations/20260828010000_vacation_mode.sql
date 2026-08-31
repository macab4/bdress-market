-- Modo vacaciones — la vendedora pausa toda su tienda de una sola vez en
-- vez de prenda por prenda. Mientras está activo: sus prendas no aparecen
-- en catálogo/búsqueda/perfil público (para cualquiera que no sea ella
-- misma) y no se pueden comprar — pero no se toca el status individual de
-- cada listing, así que al desactivarlo todo vuelve exactamente a como
-- estaba (nada de reactivar una por una). Las órdenes ya en curso siguen
-- su proceso normal (la policy de select de orders y el resto del flujo de
-- envío no dependen de este flag).
alter table public.profiles add column vacation_mode boolean not null default false;

drop policy if exists "Prendas activas visibles para todos" on public.listings;
create policy "Prendas activas visibles para todos" on public.listings
  for select using (
    (
      status = 'active'
      and not exists (
        select 1 from public.profiles
        where profiles.id = listings.seller_id and profiles.vacation_mode = true
      )
    )
    or seller_id = auth.uid()
    or exists (
      select 1 from public.orders
      where orders.listing_id = listings.id
      and orders.buyer_id = auth.uid()
    )
  );

-- Bloquea también el intento de compra si el link quedó abierto de antes
-- (RLS no alcanza acá porque la función corre security definer).
create or replace function public.create_or_reuse_pending_order(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_amount integer,
  p_commission integer,
  p_processing_fee integer,
  p_shipping_cost integer,
  p_courier_service_code text,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_address_extra text,
  p_shipping_comuna text,
  p_shipping_city text,
  p_international_consent boolean default false,
  p_international_terms_version text default null,
  p_international_user_agent text default null
)
returns table (order_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_order_id uuid;
  v_seller_vacation boolean;
begin
  select id, status, seller_id into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'listing_not_found';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_active';
  end if;
  if v_listing.seller_id = p_buyer_id then
    raise exception 'cannot_buy_own_listing';
  end if;

  select vacation_mode into v_seller_vacation from public.profiles where id = v_listing.seller_id;
  if v_seller_vacation then
    raise exception 'seller_on_vacation';
  end if;

  insert into public.orders (
    listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost,
    courier_service_code, status,
    shipping_name, shipping_phone, shipping_address, shipping_address_extra, shipping_comuna, shipping_city,
    international_terms_accepted_at, international_terms_version, international_user_agent
  ) values (
    p_listing_id, p_buyer_id, v_listing.seller_id, p_amount, p_commission, p_processing_fee, p_shipping_cost,
    p_courier_service_code, 'pending_payment',
    p_shipping_name, p_shipping_phone, p_shipping_address, coalesce(p_shipping_address_extra, ''), p_shipping_comuna, p_shipping_city,
    case when p_international_consent then now() else null end,
    p_international_terms_version, p_international_user_agent
  )
  on conflict (listing_id) where status = 'pending_payment'
  do update set
    buyer_id = excluded.buyer_id,
    amount = excluded.amount,
    commission = excluded.commission,
    processing_fee = excluded.processing_fee,
    shipping_cost = excluded.shipping_cost,
    courier_service_code = excluded.courier_service_code,
    shipping_name = excluded.shipping_name,
    shipping_phone = excluded.shipping_phone,
    shipping_address = excluded.shipping_address,
    shipping_address_extra = excluded.shipping_address_extra,
    shipping_comuna = excluded.shipping_comuna,
    shipping_city = excluded.shipping_city,
    international_terms_accepted_at = excluded.international_terms_accepted_at,
    international_terms_version = excluded.international_terms_version,
    international_user_agent = excluded.international_user_agent,
    created_at = case when public.orders.buyer_id <> excluded.buyer_id then now() else public.orders.created_at end
  where public.orders.buyer_id = p_buyer_id or public.orders.created_at < now() - interval '30 minutes'
  returning public.orders.id into v_order_id;

  if v_order_id is null then
    raise exception 'listing_reserved_by_other_buyer';
  end if;

  return query select v_order_id;
end;
$$;
