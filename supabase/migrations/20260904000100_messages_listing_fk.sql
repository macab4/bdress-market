-- Confirmado directamente contra prod: falta la foreign key de
-- messages.listing_id hacia listings.id (PostgREST: "Could not find a
-- relationship between 'messages' and 'listings'"). schema.sql la declara
-- desde siempre (`listing_id uuid references public.listings(id) not
-- null`), pero nunca se aplicó en prod — de nuevo el mismo patrón de
-- migraciones nunca corridas. Sin esta FK, cualquier select que intente
-- embeber listing:listings(...) directo desde messages (como el inbox de
-- /dashboard/messages) falla con error PGRST200, silenciado como de
-- costumbre, y esas conversaciones desaparecen de la lista aunque los
-- mensajes existan (se ven bien entrando directo a la conversación, que
-- consulta listings aparte).
alter table public.messages drop constraint if exists messages_listing_id_fkey;
alter table public.messages add constraint messages_listing_id_fkey
  foreign key (listing_id) references public.listings(id);
