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
  phone       text,
  address     text,
  comuna      text,
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
  category      text not null check (category in ('mujer','hombre','ninos','unisex')),
  subcategory   text not null default '',
  size          text not null,
  brand         text not null default '',
  condition     text not null check (condition in ('nuevo_con_etiquetas','nuevo_sin_etiquetas','muy_bueno','bueno','satisfactorio')),
  colors        text[] not null default '{}' check (array_length(colors, 1) is null or array_length(colors, 1) <= 2),
  shipping_size text not null default 'mediano' check (shipping_size in ('pequeno','mediano','grande')),
  price         integer not null check (price > 0),
  photos        text[] not null default '{}',
  status        text not null default 'active' check (status in ('active','sold','paused')),
  created_at    timestamptz default now()
);
alter table public.listings enable row level security;

create policy "Prendas activas visibles para todos" on public.listings
  for select using (
    status = 'active'
    or seller_id = auth.uid()
    or exists (
      select 1 from public.orders
      where orders.listing_id = listings.id
      and orders.buyer_id = auth.uid()
    )
  );

create policy "Vendedora crea sus prendas" on public.listings
  for insert with check (auth.uid() = seller_id);

create policy "Vendedora edita sus prendas" on public.listings
  for update using (auth.uid() = seller_id);

create policy "Vendedora elimina sus prendas" on public.listings
  for delete using (auth.uid() = seller_id);

-- Ofertas (negociación de precio estilo Vinted)
create table public.offers (
  id                   uuid default gen_random_uuid() primary key,
  listing_id           uuid references public.listings(id) on delete cascade not null,
  buyer_id             uuid references public.profiles(id) not null,
  seller_id            uuid references public.profiles(id) not null,
  original_price       integer not null,
  offered_price        integer not null check (offered_price > 0),
  proposed_by          text not null check (proposed_by in ('buyer','seller')),
  status               text not null default 'pending'
                         check (status in ('pending','accepted','rejected','countered','expired','cancelled')),
  round                integer not null default 1,
  parent_offer_id      uuid references public.offers(id),
  expires_at           timestamptz not null,
  accepted_expires_at  timestamptz,
  created_at           timestamptz default now()
);
alter table public.offers enable row level security;

create policy "Compradora y vendedora ven sus ofertas" on public.offers
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Compradora o vendedora crean ofertas y contraofertas" on public.offers
  for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Participante actualiza el estado de su oferta" on public.offers
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Órdenes
create table public.orders (
  id                    uuid default gen_random_uuid() primary key,
  listing_id            uuid references public.listings(id) not null,
  buyer_id              uuid references public.profiles(id) not null,
  seller_id             uuid references public.profiles(id) not null,
  amount                integer not null,
  commission            integer not null,
  processing_fee        integer not null default 0,
  shipping_cost         integer not null default 0,
  status                text not null default 'pending_payment'
                          check (status in ('pending_payment','paid','shipped','delivered','completed','disputed','cancelled')),
  tracking_number       text,
  payment_ref           text,
  dispute_reason        text,
  shipping_name         text not null,
  shipping_phone        text not null,
  shipping_address      text not null,
  shipping_address_extra text not null default '',
  shipping_comuna       text not null,
  shipping_city         text not null,
  courier_service_code  text,
  courier_tracking_number text,
  courier_barcode       text,
  label_url             text,
  paid_at               timestamptz,
  shipped_at            timestamptz,
  confirmed_at          timestamptz,
  completed_at          timestamptz,
  buyer_review_reminded_at  timestamptz,
  seller_review_reminded_at timestamptz,
  created_at            timestamptz default now()
);
alter table public.orders enable row level security;

create policy "Orden visible para compradora y vendedora" on public.orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Compradora crea orden" on public.orders
  for insert with check (auth.uid() = buyer_id);

create policy "Vendedora actualiza estado de envío" on public.orders
  for update using (auth.uid() = seller_id or auth.uid() = buyer_id);

-- Favoritos
create table public.favorites (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  listing_id  uuid references public.listings(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique (user_id, listing_id)
);
alter table public.favorites enable row level security;

create policy "Usuaria ve sus favoritos" on public.favorites
  for select using (auth.uid() = user_id);

create policy "Usuaria agrega favoritos" on public.favorites
  for insert with check (auth.uid() = user_id);

create policy "Usuaria quita sus favoritos" on public.favorites
  for delete using (auth.uid() = user_id);

-- Mensajes
create table public.messages (
  id          uuid default gen_random_uuid() primary key,
  sender_id   uuid references public.profiles(id) not null,
  receiver_id uuid references public.profiles(id) not null,
  listing_id  uuid references public.listings(id) not null,
  content     text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);
alter table public.messages enable row level security;

create policy "Mensajes visibles para sender y receiver" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Usuario envía mensajes" on public.messages
  for insert with check (auth.uid() = sender_id);

create policy "Receptor marca sus mensajes como leídos" on public.messages
  for update using (auth.uid() = receiver_id);

-- Mensajes bloqueados por compartir datos de contacto/pago (solo lectura interna)
create table public.message_flags (
  id           uuid default gen_random_uuid() primary key,
  sender_id    uuid references public.profiles(id) not null,
  receiver_id  uuid references public.profiles(id) not null,
  listing_id   uuid references public.listings(id) not null,
  content      text not null,
  reason       text not null,
  reviewed_at  timestamptz,
  created_at   timestamptz default now()
);
alter table public.message_flags enable row level security;

-- Reseñas
create table public.reviews (
  id           uuid default gen_random_uuid() primary key,
  reviewer_id  uuid references public.profiles(id) not null,
  reviewed_id  uuid references public.profiles(id) not null,
  order_id     uuid references public.orders(id) not null,
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz default now(),
  unique (order_id, reviewer_id)
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

-- ============================================================
-- Migración: agregar columna color a listings (filtro estilo Vinted)
-- Pegar y correr en Supabase Dashboard → SQL Editor. Las prendas
-- publicadas antes de esto quedan con color = null hasta que se editen.
-- ============================================================
alter table public.listings add column color text
  check (color in ('negro','gris','blanco','crema','beige','naranja_pastel','naranja','coral','rojo','burdeos','rosa','rosa_palido','morado','lila','azul_claro','azul','azul_marino','turquesa','menta','verde','verde_oscuro','caqui','marron','amarillo','plateado','dorado','varios','transparente'));

-- ============================================================
-- Migración: sistema de ofertas (negociación de precio estilo Vinted)
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
create table public.offers (
  id                   uuid default gen_random_uuid() primary key,
  listing_id           uuid references public.listings(id) on delete cascade not null,
  buyer_id             uuid references public.profiles(id) not null,
  seller_id            uuid references public.profiles(id) not null,
  original_price       integer not null,
  offered_price        integer not null check (offered_price > 0),
  proposed_by          text not null check (proposed_by in ('buyer','seller')),
  status               text not null default 'pending'
                         check (status in ('pending','accepted','rejected','countered','expired','cancelled')),
  round                integer not null default 1,
  parent_offer_id      uuid references public.offers(id),
  expires_at           timestamptz not null,
  accepted_expires_at  timestamptz,
  created_at           timestamptz default now()
);
alter table public.offers enable row level security;

create policy "Compradora y vendedora ven sus ofertas" on public.offers
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Compradora o vendedora crean ofertas y contraofertas" on public.offers
  for insert with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Participante actualiza el estado de su oferta" on public.offers
  for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- ============================================================
-- Migración: mensajería comprador-vendedora
-- La tabla messages ya existe desde el schema inicial — esto solo agrega
-- lo necesario para poder marcar mensajes como leídos.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.messages add column read_at timestamptz;

create policy "Receptor marca sus mensajes como leídos" on public.messages
  for update using (auth.uid() = receiver_id);

-- ============================================================
-- Migración: registro de mensajes bloqueados por compartir datos de
-- contacto/pago (teléfono, email, dirección, transferencias, etc.)
-- Solo lo lee el equipo (vía admin), no tiene policy de select para
-- usuarias — no queremos que nadie vea qué le bloquearon a quién.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
create table public.message_flags (
  id           uuid default gen_random_uuid() primary key,
  sender_id    uuid references public.profiles(id) not null,
  receiver_id  uuid references public.profiles(id) not null,
  listing_id   uuid references public.listings(id) not null,
  content      text not null,
  reason       text not null,
  created_at   timestamptz default now()
);
alter table public.message_flags enable row level security;

-- ============================================================
-- Migración: marcar alertas de mensajes bloqueados como revisadas
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.message_flags add column reviewed_at timestamptz;

-- ============================================================
-- Migración: marca a las vendedoras importadas del marketplace anterior
-- (julio 2026), para poder armar un embudo de activación en el admin.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.profiles add column legacy_seller boolean not null default false;

-- ============================================================
-- Migración: permite hasta 2 colores por prenda (antes era uno solo)
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.listings add column colors text[] not null default '{}';
update public.listings set colors = array[color] where color is not null;
alter table public.listings drop column color;
alter table public.listings add constraint listings_colors_max2
  check (array_length(colors, 1) is null or array_length(colors, 1) <= 2);

-- ============================================================
-- Migración: panel de monitoreo (visitas, sesiones, ubicación)
-- Se escribe desde middleware.ts en cada visita — solo el service role
-- lee/escribe, por eso no lleva policies de RLS para usuarias.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
create table public.page_views (
  id          bigint generated always as identity primary key,
  path        text not null,
  visitor_id  uuid not null,
  user_id     uuid references public.profiles(id),
  country     text,
  region      text,
  city        text,
  created_at  timestamptz not null default now()
);
create index page_views_created_at_idx on public.page_views (created_at);
create index page_views_visitor_id_idx on public.page_views (visitor_id);
alter table public.page_views enable row level security;

-- ============================================================
-- Migración: reseñas mutuas (compradora ↔ vendedora) con seguimiento
-- por correo. completed_at registra cuándo la orden pasó a "completed"
-- (antes no quedaba guardado); las columnas *_review_reminded_at evitan
-- mandar el correo de seguimiento más de una vez por lado.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.orders add column completed_at timestamptz;
alter table public.orders add column buyer_review_reminded_at timestamptz;
alter table public.orders add column seller_review_reminded_at timestamptz;

-- ============================================================
-- Seguir vendedoras + notificaciones in-app. Al publicar (o reactivar)
-- una prenda, se notifica automáticamente a quienes siguen a esa
-- vendedora. El trigger corre security definer para poder insertar en
-- notifications sin que cada seguidora necesite permiso de insert ahí.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
create table public.follows (
  id           uuid default gen_random_uuid() primary key,
  follower_id  uuid references public.profiles(id) on delete cascade not null,
  followed_id  uuid references public.profiles(id) on delete cascade not null,
  created_at   timestamptz default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);
alter table public.follows enable row level security;

create policy "Cualquiera ve relaciones de seguimiento" on public.follows
  for select using (true);

create policy "Usuaria sigue a otra" on public.follows
  for insert with check (auth.uid() = follower_id);

create policy "Usuaria deja de seguir" on public.follows
  for delete using (auth.uid() = follower_id);

create table public.notifications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text not null default 'new_listing',
  actor_id    uuid references public.profiles(id) on delete cascade not null,
  listing_id  uuid references public.listings(id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
create index notifications_user_id_idx on public.notifications (user_id);

create policy "Usuaria ve sus notificaciones" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Usuaria marca sus notificaciones como leidas" on public.notifications
  for update using (auth.uid() = user_id);

create function public.notify_followers_new_listing()
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

create trigger listings_notify_followers
  after insert or update of status on public.listings
  for each row execute function public.notify_followers_new_listing();

-- ============================================================
-- Renovar (bump gratis) + Destacar (boost pagado). bumped_at ordena
-- "más recientes" en vez de created_at, y se actualiza cada vez que la
-- vendedora renueva su prenda (máximo una vez cada BUMP_COOLDOWN_DAYS,
-- ver src/lib/catalog.ts). featured_until marca hasta cuándo una prenda
-- aparece en la fila "Destacadas" de la home tras un boost pagado.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.listings add column bumped_at timestamptz not null default now();
update public.listings set bumped_at = created_at;

alter table public.listings add column featured_until timestamptz;

create table public.listing_boosts (
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

create policy "Vendedora ve sus boosts" on public.listing_boosts
  for select using (auth.uid() = seller_id);

create policy "Vendedora crea sus boosts" on public.listing_boosts
  for insert with check (auth.uid() = seller_id);

-- ============================================================
-- Nueva taxonomía de categorías (Departamento > Categoría > Tipo de
-- producto) + características separadas (largo, ocasión, temporada,
-- estilo, material). Todo aditivo y nullable: category/subcategory
-- viejos quedan intactos hasta que la nueva clasificación esté
-- verificada. pending_review marca las prendas migradas desde el
-- subcategory viejo que no se pudieron mapear con certeza (ver script
-- de migración). Los índices son para que los filtros del catálogo no
-- hagan table scan a medida que crece la cantidad de prendas.
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.listings add column product_category text;
alter table public.listings add column product_type text;
alter table public.listings add column length text;
alter table public.listings add column occasion text[] not null default '{}';
alter table public.listings add column season text;
alter table public.listings add column style text;
alter table public.listings add column material text;
alter table public.listings add column pending_review boolean not null default false;

create index listings_category_idx on public.listings (category);
create index listings_product_category_idx on public.listings (product_category);
create index listings_product_type_idx on public.listings (product_type);
create index listings_brand_idx on public.listings (brand);
create index listings_size_idx on public.listings (size);
create index listings_status_idx on public.listings (status);
create index listings_price_idx on public.listings (price);
create index listings_bumped_at_idx on public.listings (bumped_at);

-- ============================================================
-- Guardar búsqueda (MVP) — guarda la querystring de filtros del catálogo
-- para volver a aplicarla después. Sin avisos automáticos todavía (eso
-- sería una fase aparte, en paralelo al sistema de follows/notifications).
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
create table public.saved_searches (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  label      text,
  params     text not null,
  created_at timestamptz default now()
);
alter table public.saved_searches enable row level security;

create policy "Usuaria ve sus búsquedas guardadas" on public.saved_searches
  for select using (auth.uid() = user_id);

create policy "Usuaria guarda una búsqueda" on public.saved_searches
  for insert with check (auth.uid() = user_id);

create policy "Usuaria elimina su búsqueda guardada" on public.saved_searches
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Migración: Selección internacional (prendas por encargo desde Vinted
-- España u otra plataforma internacional) + fix de condición de carrera
-- en la reserva de pago (aplica a TODO el catálogo, no solo internacional).
-- Mismo contenido que supabase/migrations/20260806000000_international_products.sql
-- Pegar y correr en Supabase Dashboard → SQL Editor. 100% aditiva.
-- ============================================================

-- 1) listings — solo columnas públicas-seguras. Nada sensible (precio
-- original, URL, costos) va aquí porque la tabla ya tiene una policy
-- pública de SELECT. Lo sensible vive en listing_sourcing (más abajo).
alter table public.listings add column source_type text not null default 'local'
  check (source_type in ('local', 'international_on_demand'));
alter table public.listings add column international_lead_time_min_days integer;
alter table public.listings add column international_lead_time_max_days integer;
alter table public.listings add column international_shipping_notes text;

create index listings_source_type_idx on public.listings (source_type);

-- 2) listing_sourcing — todo lo administrativo/sensible de un listing
-- internacional, 1:1 con listings. Sin policies de select/insert/update
-- para usuarias (mismo patrón que message_flags/page_views): solo se
-- lee/escribe con el cliente service-role desde rutas /api/admin/**.
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

-- 3) orders — carril de estado internacional, paralelo a `status`
-- (nunca se mezclan). Queda null para órdenes locales.
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

-- 4) order_status_history — auditoría del carril internacional. Sin
-- policy de select para usuarias: internal_note/changed_by nunca deben
-- ser legibles por una usuaria vía select('*'). La clienta lee su
-- historial a través de /api/orders/[id]/status-history, que filtra
-- columnas server-side antes de responder.
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

-- 5) international_events — log mínimo de analítica para la modalidad
-- internacional. Insert-only vía service-role.
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

-- 6) Fix de condición de carrera en la reserva de pago — aplica a TODO
-- el catálogo. Ver src/app/api/payment/create/route.ts. El índice único
-- parcial + esta función hacen la reserva atómica.
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

-- ============================================================
-- Migración: agrega "Depop" como plataforma de origen válida para
-- productos internacionales (además de Vinted/Manual/Otra).
-- Mismo contenido que supabase/migrations/20260806010000_add_depop_source_platform.sql
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.listing_sourcing drop constraint if exists listing_sourcing_source_platform_check;
alter table public.listing_sourcing add constraint listing_sourcing_source_platform_check
  check (source_platform in ('vinted', 'depop', 'manual', 'other'));
