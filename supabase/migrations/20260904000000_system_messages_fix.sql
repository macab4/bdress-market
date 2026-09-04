-- La migración 20260901000000_system_messages.sql nunca se corrió en
-- producción — mismo patrón que notifications/follows. Confirmado
-- directamente contra prod: "column messages.is_system does not exist".
-- Esto rompía toda conversación que pidiera esa columna
-- (dashboard/messages/[listingId]/[otherUserId]) con un error de Postgres
-- que quedaba silenciado, mostrando "Todavía no hay mensajes" aunque sí
-- había mensajes reales — y además hacía fallar en silencio cada inserción
-- de mensaje de sistema (sendSystemMessage en orderNotifications.ts) desde
-- el 31 de agosto.
alter table public.messages add column if not exists is_system boolean not null default false;
