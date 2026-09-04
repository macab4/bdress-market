-- Confirmado directamente contra prod: "column messages.read_at does not
-- exist". Declarada en schema.sql desde el principio (tanto en el create
-- table original como en un alter table posterior, ver comentario en
-- 20260904000100_messages_listing_fk.sql sobre el mismo patrón) pero nunca
-- aplicada. Rompía en silencio: el contador de mensajes no leídos del
-- navbar, marcar mensajes como leídos al abrir una conversación, y —el que
-- disparó esta investigación— el embed de messages en el inbox
-- (/dashboard/messages), que pide esta columna explícitamente.
alter table public.messages add column if not exists read_at timestamptz;
