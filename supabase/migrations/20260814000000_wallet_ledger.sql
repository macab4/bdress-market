-- Saldo B-Dress (Fase 1) — cuando una venta se completa hoy no pasa nada con
-- la plata: el pago a la vendedora sigue siendo manual (ver el comentario en
-- cron/auto-release). Esta migración crea el ledger de movimientos que va a
-- reemplazar eso: wallet_transactions es la fuente de verdad (append-only,
-- inmutable — nunca se hace UPDATE/DELETE de una fila ya insertada, revertir
-- es insertar una fila nueva de signo contrario), wallet_accounts es solo un
-- saldo cacheado mantenido por trigger, nunca escrito directo desde código
-- de aplicación. Fase 1 solo implementa sale_pending/sale_release/
-- sale_reversal/admin_credit/admin_debit — el resto de los tipos existen en
-- el check ya desde ahora para no tener que volver a migrar el enum cuando
-- lleguen retiros/compras con saldo/gift cards en fases siguientes.

create table if not exists public.wallet_accounts (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null unique,
  available_balance integer not null default 0,
  pending_balance   integer not null default 0,
  reserved_balance  integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint wallet_accounts_available_nonneg check (available_balance >= 0),
  constraint wallet_accounts_pending_nonneg check (pending_balance >= 0),
  constraint wallet_accounts_reserved_nonneg check (reserved_balance >= 0)
);

comment on table public.wallet_accounts is
  'Saldo cacheado por usuaria — SIEMPRE derivado de wallet_transactions vía el trigger wallet_transactions_apply_balance. Nunca hacer UPDATE directo desde código de aplicación.';

alter table public.wallet_accounts enable row level security;

drop policy if exists "Usuaria ve su propio saldo" on public.wallet_accounts;
create policy "Usuaria ve su propio saldo" on public.wallet_accounts
  for select using (auth.uid() = user_id);
-- Sin policies de insert/update/delete: toda escritura pasa por
-- record_wallet_transaction() (security definer), invocada solo con
-- service_role desde payment/confirm, cron/auto-release y admin/resolve —
-- mismo patrón que brands/brand_aliases.

create table if not exists public.wallet_transactions (
  id                     uuid default gen_random_uuid() primary key,
  account_id             uuid references public.wallet_accounts(id) not null,
  user_id                uuid references public.profiles(id) not null,
  type                   text not null check (type in (
                            'sale_pending','sale_release','sale_reversal',
                            'withdrawal_hold','withdrawal_completed','withdrawal_cancelled',
                            'marketplace_purchase','marketplace_purchase_refund',
                            'giftcard_redemption','admin_credit','admin_debit'
                          )),
  pending_delta          integer not null default 0,
  available_delta        integer not null default 0,
  reserved_delta         integer not null default 0,
  order_id               uuid references public.orders(id) on delete set null,
  listing_id             uuid references public.listings(id) on delete set null,
  related_transaction_id uuid references public.wallet_transactions(id),
  description            text not null default '',
  metadata               jsonb not null default '{}'::jsonb,
  idempotency_key        text,
  created_by             uuid references public.profiles(id),
  created_at             timestamptz not null default now(),
  constraint wallet_transactions_has_delta check (not (pending_delta = 0 and available_delta = 0 and reserved_delta = 0))
);

comment on table public.wallet_transactions is
  'Ledger inmutable — única fuente de verdad del saldo. Nunca UPDATE/DELETE de filas existentes (ver triggers wallet_transactions_no_update/no_delete). Reversar = insertar una fila nueva de signo contrario, referenciando related_transaction_id.';
comment on column public.wallet_transactions.pending_delta is 'Delta aplicado a wallet_accounts.pending_balance';
comment on column public.wallet_transactions.available_delta is 'Delta aplicado a wallet_accounts.available_balance';
comment on column public.wallet_transactions.reserved_delta is 'Delta aplicado a wallet_accounts.reserved_balance — sin uso hasta fase 2 (retiros)';

create index if not exists wallet_transactions_user_id_created_at_idx on public.wallet_transactions (user_id, created_at desc);
create index if not exists wallet_transactions_order_id_idx on public.wallet_transactions (order_id);

-- Idempotencia #1 — como máximo un movimiento de cada tipo por orden. La
-- máquina de estados de orders.status ya garantiza que sale_release y
-- sale_reversal son mutuamente excluyentes en el tiempo para una misma
-- orden, así que esto alcanza para evitar doble acreditación aunque el cron
-- o un webhook de Mercado Pago se ejecuten dos veces.
drop index if exists wallet_transactions_order_type_unique;
create unique index wallet_transactions_order_type_unique
  on public.wallet_transactions (order_id, type)
  where order_id is not null;

-- Idempotencia #2 — para movimientos sin order_id natural (admin_credit,
-- admin_debit hoy; retiros/gift cards en fases futuras). El llamador genera
-- la key (ver src/lib/wallet.ts).
drop index if exists wallet_transactions_idempotency_key_unique;
create unique index wallet_transactions_idempotency_key_unique
  on public.wallet_transactions (idempotency_key)
  where idempotency_key is not null;

alter table public.wallet_transactions enable row level security;

drop policy if exists "Usuaria ve sus propios movimientos" on public.wallet_transactions;
create policy "Usuaria ve sus propios movimientos" on public.wallet_transactions
  for select using (auth.uid() = user_id);
-- Sin policies de insert/update/delete — ver record_wallet_transaction().

-- Inmutabilidad dura: ni siquiera con service_role se puede mutar una fila
-- ya insertada, para que un bug futuro no pueda reescribir historia
-- financiera. Revertir siempre es una fila nueva.
create or replace function public.wallet_transactions_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'wallet_transactions es un ledger de solo-inserción — % no permitido (id=%)', tg_op, old.id;
end;
$$;

drop trigger if exists wallet_transactions_no_update on public.wallet_transactions;
create trigger wallet_transactions_no_update
  before update on public.wallet_transactions
  for each row execute function public.wallet_transactions_immutable();

drop trigger if exists wallet_transactions_no_delete on public.wallet_transactions;
create trigger wallet_transactions_no_delete
  before delete on public.wallet_transactions
  for each row execute function public.wallet_transactions_immutable();

-- Mantiene el saldo cacheado en sync, atómicamente, con cada inserción real.
-- El UPDATE toma row-lock sobre esa wallet_accounts, serializando
-- inserciones concurrentes sobre la misma cuenta — nunca "leer, calcular en
-- la app, escribir". Si el INSERT fue absorbido por ON CONFLICT DO NOTHING
-- en record_wallet_transaction(), este trigger no corre — así la
-- idempotencia también cubre el saldo cacheado, gratis.
create or replace function public.wallet_transactions_apply_balance()
returns trigger
language plpgsql
as $$
begin
  update public.wallet_accounts
  set pending_balance   = pending_balance + new.pending_delta,
      available_balance = available_balance + new.available_delta,
      reserved_balance  = reserved_balance + new.reserved_delta,
      updated_at        = now()
  where id = new.account_id;
  return new;
end;
$$;

drop trigger if exists wallet_transactions_apply_balance on public.wallet_transactions;
create trigger wallet_transactions_apply_balance
  after insert on public.wallet_transactions
  for each row execute function public.wallet_transactions_apply_balance();

-- Reconciliación: compara el saldo cacheado contra la suma real del ledger,
-- para poder verificar en cualquier momento que el caché no divergió.
create or replace view public.wallet_balance_reconciliation as
select
  wa.user_id,
  wa.available_balance, wa.pending_balance, wa.reserved_balance,
  coalesce(sum(wt.available_delta), 0) as computed_available,
  coalesce(sum(wt.pending_delta), 0)   as computed_pending,
  coalesce(sum(wt.reserved_delta), 0)  as computed_reserved
from public.wallet_accounts wa
left join public.wallet_transactions wt on wt.account_id = wa.id
group by wa.user_id, wa.available_balance, wa.pending_balance, wa.reserved_balance;

-- Único punto de entrada de escritura del ledger. Crea la cuenta de forma
-- perezosa (on conflict do nothing — segura ante llamadas concurrentes) y
-- hace el insert idempotente según venga order_id o idempotency_key.
create or replace function public.record_wallet_transaction(
  p_user_id uuid,
  p_type text,
  p_pending_delta integer,
  p_available_delta integer,
  p_reserved_delta integer,
  p_order_id uuid default null,
  p_listing_id uuid default null,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_related_transaction_id uuid default null,
  p_created_by uuid default null
)
returns table (transaction_id uuid, account_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
  v_tx_id uuid;
begin
  if p_type not in ('sale_pending','sale_release','sale_reversal','withdrawal_hold',
                     'withdrawal_completed','withdrawal_cancelled','marketplace_purchase',
                     'marketplace_purchase_refund','giftcard_redemption','admin_credit','admin_debit') then
    raise exception 'tipo de movimiento inválido: %', p_type;
  end if;

  insert into public.wallet_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select id into v_account_id from public.wallet_accounts where user_id = p_user_id;

  if p_order_id is not null then
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    on conflict (order_id, type) where order_id is not null do nothing
    returning id into v_tx_id;
  elsif p_idempotency_key is not null then
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id into v_tx_id;
  else
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    returning id into v_tx_id;
  end if;

  return query select v_tx_id, v_account_id, (v_tx_id is not null);
end;
$$;

-- CRÍTICO: Postgres otorga EXECUTE a PUBLIC por defecto al crear una
-- función. Sin este revoke, cualquier usuaria autenticada podría llamar
-- supabase.rpc('record_wallet_transaction', {p_user_id: '<otra-usuaria>', ...})
-- desde el navegador y acreditarse plata a sí misma o a otra cuenta. A
-- diferencia de create_or_reuse_pending_order (que sí la invoca la
-- compradora), esta función NUNCA se otorga a `authenticated`.
revoke all on function public.record_wallet_transaction(
  uuid, text, integer, integer, integer, uuid, uuid, text, jsonb, text, uuid, uuid
) from public;
grant execute on function public.record_wallet_transaction(
  uuid, text, integer, integer, integer, uuid, uuid, text, jsonb, text, uuid, uuid
) to service_role;
