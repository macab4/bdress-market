-- Email diario de "nuevas prendas de quienes sigues" — la notificación
-- in-app (tabla notifications, tipo 'new_listing', trigger
-- notify_followers_new_listing en supabase-schema.sql) ya existía, pero
-- nunca se avisaba por correo. emailed_at marca qué notificaciones ya
-- entraron en un digest, para que el cron follow-digest no reenvíe la
-- misma dos veces.
alter table public.notifications add column emailed_at timestamptz;
