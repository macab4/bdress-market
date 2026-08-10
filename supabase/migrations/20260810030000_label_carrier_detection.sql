-- Transportista y número de seguimiento detectados (o ingresados a mano)
-- desde la etiqueta que sube la admin en modo manual — ver
-- api/admin/orders/[id]/label. Deliberadamente separados de
-- tracking_number/status='shipped' (que siguen reflejando que la vendedora
-- ya despachó de verdad, no que la etiqueta ya existe) para no alterar esa
-- lógica existente.
alter table public.orders add column label_courier text;
alter table public.orders add column label_tracking_number text;
alter table public.orders add column label_uploaded_at timestamptz;
