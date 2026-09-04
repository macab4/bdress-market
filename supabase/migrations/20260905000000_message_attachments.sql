-- Fase 1 del rediseño de mensajería: fotos dentro del chat. Bucket privado
-- nuevo (primero del proyecto — "listings" es público) + tabla de adjuntos.
-- El path de cada archivo es "{listing_id}/{sender_id}/{uuid}.ext" para que
-- las policies de storage.objects puedan verificar pertenencia leyendo
-- segmentos del path (storage.foldername) sin un join caro. Las fotos se
-- sirven siempre con signed URLs de corta duración desde el servidor, nunca
-- con URL pública permanente.

create table if not exists public.message_attachments (
  id           uuid default gen_random_uuid() primary key,
  message_id   uuid references public.messages(id) on delete cascade not null,
  storage_path text not null,
  mime_type    text not null,
  size_bytes   integer not null,
  width        integer,
  height       integer,
  created_at   timestamptz default now()
);
create index if not exists message_attachments_message_id_idx on public.message_attachments (message_id);
alter table public.message_attachments enable row level security;

drop policy if exists "Participantes ven adjuntos de su conversación" on public.message_attachments;
create policy "Participantes ven adjuntos de su conversación" on public.message_attachments
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_attachments.message_id
        and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
    )
  );

drop policy if exists "Remitente agrega adjuntos a su propio mensaje" on public.message_attachments;
create policy "Remitente agrega adjuntos a su propio mensaje" on public.message_attachments
  for insert with check (
    exists (
      select 1 from public.messages m
      where m.id = message_attachments.message_id and auth.uid() = m.sender_id
    )
  );

insert into storage.buckets (id, name, public)
  values ('chat-attachments', 'chat-attachments', false)
  on conflict (id) do nothing;

drop policy if exists "Participantes ven fotos del chat" on storage.objects;
create policy "Participantes ven fotos del chat" on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and exists (
      select 1 from public.messages m
      where m.listing_id::text = (storage.foldername(name))[1]
        and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
    )
  );

-- Al momento de subir la foto el mensaje todavía no existe (se sube primero,
-- se referencia después) — por eso el insert solo exige que la usuaria suba
-- dentro de su propia carpeta ("{listing_id}/{sender_id}/..."), no que el
-- mensaje ya exista. Si nunca se llega a crear el mensaje, el archivo queda
-- huérfano pero nadie más puede leerlo (la policy de select sí exige el
-- mensaje real).
drop policy if exists "Usuaria sube fotos a su propia carpeta del chat" on storage.objects;
create policy "Usuaria sube fotos a su propia carpeta del chat" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[2]
  );
