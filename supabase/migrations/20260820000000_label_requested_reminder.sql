-- Cuando la vendedora pide la etiqueta en modo manual (MANUAL_LABEL_MODE),
-- hasta ahora la única señal para la admin era un correo — si no lo veía a
-- tiempo, no quedaba ningún recordatorio dentro del sitio. Esta columna
-- guarda cuándo se pidió, para poder mostrar un listado persistente en el
-- panel admin (no solo depender del inbox) filtrando por
-- label_requested_at is not null and label_url is null.
alter table public.orders
  add column if not exists label_requested_at timestamptz;

comment on column public.orders.label_requested_at is
  'Cuándo la vendedora pidió la etiqueta de envío en modo manual. No se limpia al subir la etiqueta — el filtro "pendiente" es label_requested_at is not null and label_url is null.';
