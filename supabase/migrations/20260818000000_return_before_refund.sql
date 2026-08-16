-- Reembolso con devolución: cuando una compradora ya tiene la prenda en
-- mano y hay que recuperarla antes de devolverle la plata (dispute resuelta
-- con "Aprobar devolución" en vez de "Reembolsar" instantáneo). El
-- reembolso queda RETENIDO hasta que la admin marca la devolución como
-- recibida — ver api/admin/orders/[id]/mark-return-received. El "Reembolsar"
-- instantáneo existente (admin/orders/[id]/resolve) no cambia — sigue
-- sirviendo para los casos donde no hay nada físico que devolver (ej. la
-- vendedora nunca despachó).
--
-- Bdress cubre el costo de la etiqueta de devolución (no se le cobra a la
-- compradora ni a la vendedora) — es lo que ya promete la "Protección
-- Bdress" (reembolso completo), ver terminos/page.tsx.

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending_payment','paid','shipped','delivered','completed','disputed','cancelled',
    'return_pending'
  ));

alter table public.orders
  add column if not exists return_approved_at timestamptz,
  add column if not exists return_label_url text,
  add column if not exists return_label_courier text,
  add column if not exists return_label_tracking_number text,
  add column if not exists return_label_uploaded_at timestamptz,
  add column if not exists return_received_at timestamptz;

comment on column public.orders.return_label_url is
  'Etiqueta de envío para que la compradora devuelva la prenda a la vendedora — la sube la admin, mismo proceso manual que la etiqueta de ida (label_url).';
comment on column public.orders.return_received_at is
  'Cuando la admin confirmó (vía seguimiento del courier) que la vendedora recibió la prenda devuelta — recién ahí se ejecuta el reembolso real (mark-return-received).';
