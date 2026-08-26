-- Panel de carritos abandonados (admin) + recuperación por email. Una sola
-- columna nueva, mismo patrón que buyer_review_reminded_at /
-- label_requested_reminder: guarda cuándo se mandó el recordatorio de
-- recuperación para no reenviarlo nunca dos veces desde el cron.
alter table public.orders
  add column abandoned_recovery_sent_at timestamptz;
