-- Registra cuándo la vendedora descargó su etiqueta por primera vez (desde
-- el correo o desde "Mis ventas") — ver api/orders/[id]/label/download.
alter table public.orders add column label_downloaded_at timestamptz;
