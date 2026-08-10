-- Evita mandar el recordatorio diario de despacho más de una vez por día
-- (ver api/cron/ship-reminder) — sin este campo, correr el cron dos veces el
-- mismo día duplicaría el correo.
alter table public.orders add column last_ship_reminder_sent_at timestamptz;
