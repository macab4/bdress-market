-- Recordatorio único de "destacar" — ver cron boost-reminder. Solo se
-- manda una vez por prenda (nunca reenviar) para no ser spam; si la
-- vendedora igual no destaca, no insistimos de nuevo por esa misma prenda.
alter table public.listings add column boost_reminder_sent_at timestamptz;
