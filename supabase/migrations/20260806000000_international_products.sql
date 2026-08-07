-- ============================================================
-- Migración: Selección internacional (prendas por encargo desde Vinted
-- España u otra plataforma internacional) + fix de condición de carrera
-- en la reserva de pago (aplica a TODO el catálogo, no solo internacional).
-- Pegar y correr en Supabase Dashboard → SQL Editor. 100% aditiva: no
-- borra ni renombra columnas existentes, y todas las tablas/columnas
-- nuevas quedan con default seguro para las filas ya existentes.
-- ============================================================

-- --------------------------------------------------------------
-- 1) listings — solo columnas públicas-seguras. Nada sensible (precio
-- original, URL, costos) va aquí porque la tabla ya tiene una policy
-- pública de SELECT: cualquier columna nueva sería visible para
-- cualquiera. Lo sensible vive en listing_sourcing (más abajo).
-- --------------------------------------------------------------
alter table public.listings add column source_type text not null default 'local'
  check (source_type in ('local', 'international_on_demand'));
alter table public.listings add column international_lead_time_min_days integer;
alter table public.listings add column international_lead_time_max_days integer;
alter table public.listings add column international_shipping_notes text;

create index listings_source_type_idx on public.listings (source_type);

-- --------------------------------------------------------------
-- 2) listing_sourcing — todo lo administrativo/sensible de un listing
-- internacional, 1:1 con listings. Sin policies de select/insert/update
-- para usuarias (mismo patrón que message_flags/page_views): solo se
-- lee/escribe con el cliente service-role desde rutas /api/admin/**.
-- --------------------------------------------------------------
create table public.listing_sourcing (
  listing_id                uuid primary key references public.listings(id) on delete cascade,
  source_platform           text not null default 'manual' check (source_platform in ('vinted', 'manual', 'other')),
  source_url                text,
  source_listing_id         text,
  source_original_price     integer,
  source_original_currency  text,
  source_last_verified_at   timestamptz,
  source_status             text not null default 'pending_verification'
                              check (source_status in ('available', 'pending_verification', 'purchased', 'unavailable')),
  -- Cache de solo-lectura del international_status de la orden asociada más
  -- reciente, para poder filtrar/columnear en el panel admin sin joinear
  -- orders. La fuente de verdad sigue siendo orders.international_status +
  -- order_status_history — este campo es solo un espejo de conveniencia.
  international_product_status text,
  international_cost_estimate     integer,
  international_customs_estimate  integer,
  international_internal_notes    text,
  external_seller_name      text,
  external_location         text,
  external_purchase_price   integer,
  external_purchase_currency text,
  external_purchase_date    date,
  external_order_reference  text,
  external_tracking_number  text,
  external_tracking_url     text,
  content_authorization_confirmed_by uuid references public.profiles(id),
  content_authorization_confirmed_at timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
alter table public.listing_sourcing enable row level security;

-- --------------------------------------------------------------
-- 3) orders — carril de estado internacional, paralelo a `status`
-- (nunca se mezclan). Queda null para órdenes locales.
-- --------------------------------------------------------------
alter table public.orders add column international_status text
  check (international_status in (
    'awaiting_source_verification', 'source_confirmed', 'source_purchase_pending', 'source_purchased',
    'source_unavailable', 'received_at_foreign_hub', 'international_transit', 'customs_processing',
    'received_in_chile', 'quality_check', 'national_shipping_pending', 'nationally_shipped', 'delivered',
    'cancellation_pending', 'refund_pending', 'refunded'
  ));
alter table public.orders add column international_terms_accepted_at timestamptz;
alter table public.orders add column international_terms_version text;
alter table public.orders add column international_user_agent text;
alter table public.orders add column delay_notice_sent_at timestamptz;

create index orders_international_status_idx on public.orders (international_status);

-- --------------------------------------------------------------
-- 4) order_status_history — auditoría del carril internacional. Sin
-- policy de select para usuarias: internal_note/changed_by nunca deben
-- ser legibles por una usuaria vía select('*'). La clienta lee su
-- historial a través de /api/orders/[id]/status-history, que filtra
-- columnas server-side antes de responder.
-- --------------------------------------------------------------
create table public.order_status_history (
  id              uuid default gen_random_uuid() primary key,
  order_id        uuid references public.orders(id) on delete cascade not null,
  previous_status text,
  new_status      text not null,
  changed_by      uuid references public.profiles(id),
  public_note     text,
  internal_note   text,
  created_at      timestamptz not null default now()
);
create index order_status_history_order_id_idx on public.order_status_history (order_id);
alter table public.order_status_history enable row level security;

-- --------------------------------------------------------------
-- 5) international_events — log mínimo de analítica para la modalidad
-- internacional (no existía ningún sistema de eventos custom antes de
-- esto, solo el page_views automático de middleware.ts). Insert-only
-- vía service-role.
-- --------------------------------------------------------------
create table public.international_events (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  listing_id  uuid references public.listings(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index international_events_type_idx on public.international_events (event_type);
create index international_events_created_at_idx on public.international_events (created_at);
alter table public.international_events enable row level security;

-- --------------------------------------------------------------
-- 6) Fix de condición de carrera en la reserva de pago — aplica a TODO
-- el catálogo. Hoy dos compradoras pueden terminar pagando el mismo
-- listing porque la creación de la orden pending_payment es un
-- select-luego-insert no atómico (ver src/app/api/payment/create/route.ts).
-- El índice único parcial + esta función hacen la reserva atómica: la
-- función bloquea la fila del listing, valida su estado, y hace un
-- upsert atómico sobre el único pending_payment permitido por listing.
-- Si otra compradora ya tiene la reserva, lanza listing_reserved_by_other_buyer.
-- --------------------------------------------------------------
create unique index orders_listing_pending_unique on public.orders (listing_id)
  where status = 'pending_payment';

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
  -- El WHERE del DO UPDATE decide quién puede "quedarse" con la reserva en
  -- conflicto: la misma compradora reintentando, o cualquiera si la reserva
  -- existente quedó abandonada (>30 min sin pagar — mismo plazo que
  -- PENDING_ORDER_EXPIRY_MINUTES en src/lib/catalog.ts). Esto resuelve la
  -- expiración de la reserva de forma atómica y perezosa, sin depender de la
  -- frecuencia de un cron (los crons de Vercel Hobby solo corren 1 vez al
  -- día) — expire-pending-orders sigue existiendo como limpieza periódica
  -- para reporting, no como mecanismo de liberación.
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

grant execute on function public.create_or_reuse_pending_order(
  uuid, uuid, integer, integer, integer, integer, text, text, text, text, text, text, text, boolean, text, text
) to authenticated;
