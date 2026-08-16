-- Índice para los crons que filtran orders por status + un corte de fecha
-- (expire-pending-orders, auto-release) y para la nueva vista de "holds
-- pendientes de liberar" en /admin/wallet (status != 'paid' + wallet_amount_applied > 0).
-- Sin este índice, esas consultas escanean toda la tabla orders — no es un
-- problema hoy con poco volumen, pero sí a medida que crece.
create index if not exists orders_status_created_at_idx on public.orders (status, created_at);
