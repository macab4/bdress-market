-- Carrito multi-vendedora: permite comprar prendas de varias vendedoras
-- distintas en un solo pago de Mercado Pago, manteniendo una orden
-- independiente por vendedora (despacho/disputas/reviews siguen igual que
-- siempre, por orden). cart_items es la lista de intención de compra (se
-- reserva recién al pagar, igual que hoy); cart_checkout_id en orders
-- agrupa las órdenes que se pagaron juntas en un mismo checkout de carrito
-- — queda null para compras directas de una sola prenda (flujo actual,
-- intacto).

create table public.cart_items (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  listing_id  uuid references public.listings(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique (user_id, listing_id)
);
alter table public.cart_items enable row level security;

create policy "Usuaria ve su carrito" on public.cart_items
  for select using (auth.uid() = user_id);

create policy "Usuaria agrega a su carrito" on public.cart_items
  for insert with check (auth.uid() = user_id);

create policy "Usuaria quita de su carrito" on public.cart_items
  for delete using (auth.uid() = user_id);

alter table public.orders add column if not exists cart_checkout_id uuid;
create index if not exists orders_cart_checkout_id_idx on public.orders (cart_checkout_id) where cart_checkout_id is not null;
