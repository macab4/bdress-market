-- Saldo B-Dress (Fase 2) — cuentas bancarias guardadas + retiros.
-- record_wallet_transaction() (ver 20260814000000_wallet_ledger.sql) sigue
-- siendo la única fuente de verdad del dinero. bank_accounts NO es dinero
-- (solo datos de referencia) así que tiene RLS self-service directa, igual
-- que favorites. withdrawals SÍ mueve dinero (reserva/libera saldo) así que
-- su escritura pasa exclusivamente por API routes server-side con
-- createAdminClient(), igual que /api/admin/wallet/adjust.

create table if not exists public.bank_accounts (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  bank            text not null,
  account_type    text not null check (account_type in ('checking','savings','vista','rut')),
  account_number  text not null,
  holder_rut      text not null,
  holder_name     text not null,
  holder_email    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.bank_accounts is
  'Cuentas bancarias guardadas por la usuaria para recibir retiros. Solo datos de referencia (no dinero) — CRUD self-service directo desde el cliente, protegido por RLS, mismo patrón que favorites.';
comment on column public.bank_accounts.account_number is
  'Texto plano — sin encriptación a nivel de columna en esta fase (sin precedente en el repo). Enmascarar SIEMPRE en UI salvo /admin/wallet/withdrawals/[id] (la admin necesita el número completo para transferir manualmente). Riesgo a revisar si se automatiza la transferencia.';

create index if not exists bank_accounts_user_id_idx on public.bank_accounts (user_id);

alter table public.bank_accounts enable row level security;

drop policy if exists "Usuaria ve sus cuentas bancarias" on public.bank_accounts;
create policy "Usuaria ve sus cuentas bancarias" on public.bank_accounts
  for select using (auth.uid() = user_id);

drop policy if exists "Usuaria agrega cuenta bancaria" on public.bank_accounts;
create policy "Usuaria agrega cuenta bancaria" on public.bank_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists "Usuaria edita su cuenta bancaria" on public.bank_accounts;
create policy "Usuaria edita su cuenta bancaria" on public.bank_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Usuaria elimina su cuenta bancaria" on public.bank_accounts;
create policy "Usuaria elimina su cuenta bancaria" on public.bank_accounts
  for delete using (auth.uid() = user_id);

create table if not exists public.withdrawals (
  id                         uuid default gen_random_uuid() primary key,
  user_id                    uuid references public.profiles(id) not null,
  bank_account_id            uuid references public.bank_accounts(id) on delete set null,
  amount                     integer not null check (amount > 0),
  status                     text not null default 'pending' check (status in ('pending','processing','completed','rejected')),
  -- Snapshot de los datos bancarios al momento de solicitar — no solo FK a
  -- bank_accounts — para que desactivar/borrar la cuenta después no afecte
  -- un retiro ya en curso.
  bank                       text not null,
  account_type               text not null check (account_type in ('checking','savings','vista','rut')),
  account_number             text not null,
  holder_rut                 text not null,
  holder_name                text not null,
  holder_email               text,
  hold_transaction_id        uuid references public.wallet_transactions(id),
  completion_transaction_id  uuid references public.wallet_transactions(id),
  requested_at               timestamptz not null default now(),
  processed_at               timestamptz,
  admin_id                   uuid references public.profiles(id),
  operation_number           text,
  receipt_url                text,
  internal_note              text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

comment on table public.withdrawals is
  'Solicitudes de retiro. Toda escritura pasa por API routes server-side con createAdminClient() — nunca insert/update directo desde el cliente (mismo motivo que wallet_transactions: record_wallet_transaction solo tiene grant a service_role).';

create index if not exists withdrawals_user_id_created_at_idx on public.withdrawals (user_id, created_at desc);
create index if not exists withdrawals_status_idx on public.withdrawals (status);

-- Un solo retiro activo (pending/processing) por usuaria a la vez —
-- confirmado con el usuario. Garantizado a nivel de DB, no solo de UI, para
-- que una carrera entre dos pestañas no cree dos solicitudes activas
-- simultáneas.
drop index if exists withdrawals_one_active_per_user_idx;
create unique index withdrawals_one_active_per_user_idx
  on public.withdrawals (user_id)
  where status in ('pending', 'processing');

alter table public.withdrawals enable row level security;

drop policy if exists "Usuaria ve sus propios retiros" on public.withdrawals;
create policy "Usuaria ve sus propios retiros" on public.withdrawals
  for select using (auth.uid() = user_id);
-- Sin insert/update/delete — ver /api/wallet/withdrawals y
-- /api/admin/withdrawals/[id]/status.
