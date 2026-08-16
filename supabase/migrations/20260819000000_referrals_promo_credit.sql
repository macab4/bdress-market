-- Sistema de referidos + Crédito B-Dress (crédito promocional, NO
-- transferible). Reutiliza el ledger existente (wallet_accounts /
-- wallet_transactions / record_wallet_transaction) en vez de crear una
-- segunda billetera — se agrega una cuarta dimensión de saldo
-- (promo_balance / promo_delta), simétrica a pending/available/reserved,
-- mantenida por el mismo trigger. `available_balance` (lo único que
-- withdrawals lee, ver api/wallet/withdrawals/route.ts) nunca se toca desde
-- ningún camino de código promocional — esa separación de columnas es la
-- garantía real de que el crédito promocional jamás puede retirarse, no
-- una regla de negocio que dependa de acordarse de chequearla en cada sitio.

-- ============================================================
-- 1. Cuarta dimensión de saldo: promo_balance / promo_delta
-- ============================================================

alter table public.wallet_accounts
  add column if not exists promo_balance integer not null default 0,
  add constraint wallet_accounts_promo_nonneg check (promo_balance >= 0);

alter table public.wallet_transactions
  add column if not exists promo_delta integer not null default 0;

comment on column public.wallet_transactions.promo_delta is
  'Delta aplicado a wallet_accounts.promo_balance — crédito promocional (referidos, ajustes admin no-transferibles). NUNCA se mezcla con available_delta.';

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_has_delta;
alter table public.wallet_transactions
  add constraint wallet_transactions_has_delta
  check (not (pending_delta = 0 and available_delta = 0 and reserved_delta = 0 and promo_delta = 0));

-- Tipos nuevos: referral_bonus (crédito por referido calificado),
-- promo_purchase_hold/completed/cancelled/refund (simétricos a
-- marketplace_purchase_* pero moviendo promo_balance en vez de
-- available_balance — mismo patrón hold→reservado→completado/cancelado
-- que ya usa el saldo real, ver src/lib/wallet.ts), y
-- admin_promo_credit/admin_promo_debit (ajuste manual explícitamente
-- promocional, para que un ajuste de admin nunca pueda mezclarse por
-- accidente con saldo real — ver api/admin/wallet/adjust).
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in (
    'sale_pending','sale_release','sale_reversal',
    'withdrawal_hold','withdrawal_completed','withdrawal_cancelled',
    'marketplace_purchase','marketplace_purchase_hold',
    'marketplace_purchase_cancelled','marketplace_purchase_refund',
    'giftcard_redemption','admin_credit','admin_debit',
    'referral_bonus',
    'promo_purchase_hold','promo_purchase_completed',
    'promo_purchase_cancelled','promo_purchase_refund',
    'admin_promo_credit','admin_promo_debit'
  ));

create or replace function public.wallet_transactions_apply_balance()
returns trigger
language plpgsql
as $$
begin
  update public.wallet_accounts
  set pending_balance   = pending_balance + new.pending_delta,
      available_balance = available_balance + new.available_delta,
      reserved_balance  = reserved_balance + new.reserved_delta,
      promo_balance     = promo_balance + new.promo_delta,
      updated_at        = now()
  where id = new.account_id;
  return new;
end;
$$;
-- El trigger ya existente (wallet_transactions_apply_balance, creado en
-- 20260814000000) sigue apuntando a esta función por nombre — no hace falta
-- recrearlo, create or replace alcanza.

-- CREATE OR REPLACE VIEW solo permite agregar columnas al final de la
-- lista, nunca insertarlas en el medio — promo_balance/computed_promo van
-- después de las columnas originales, no junto a sus pares por prolijidad.
create or replace view public.wallet_balance_reconciliation as
select
  wa.user_id,
  wa.available_balance, wa.pending_balance, wa.reserved_balance,
  coalesce(sum(wt.available_delta), 0) as computed_available,
  coalesce(sum(wt.pending_delta), 0)   as computed_pending,
  coalesce(sum(wt.reserved_delta), 0)  as computed_reserved,
  wa.promo_balance,
  coalesce(sum(wt.promo_delta), 0)     as computed_promo
from public.wallet_accounts wa
left join public.wallet_transactions wt on wt.account_id = wa.id
group by wa.user_id, wa.available_balance, wa.pending_balance, wa.reserved_balance, wa.promo_balance;

-- record_wallet_transaction cambia de firma (se agrega p_promo_delta al
-- final) — drop explícito de la firma vieja porque create or replace no
-- reemplaza una función si la lista de tipos de parámetros cambia, crearía
-- una segunda función sobrecargada en vez de reemplazar esta.
drop function if exists public.record_wallet_transaction(
  uuid, text, integer, integer, integer, uuid, uuid, text, jsonb, text, uuid, uuid
);

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
  p_created_by uuid default null,
  p_promo_delta integer default 0
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
  if p_type not in (
    'sale_pending','sale_release','sale_reversal','withdrawal_hold',
    'withdrawal_completed','withdrawal_cancelled','marketplace_purchase',
    'marketplace_purchase_hold','marketplace_purchase_cancelled','marketplace_purchase_refund',
    'giftcard_redemption','admin_credit','admin_debit',
    'referral_bonus','promo_purchase_hold','promo_purchase_completed',
    'promo_purchase_cancelled','promo_purchase_refund',
    'admin_promo_credit','admin_promo_debit'
  ) then
    raise exception 'tipo de movimiento inválido: %', p_type;
  end if;

  insert into public.wallet_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select id into v_account_id from public.wallet_accounts where user_id = p_user_id;

  if p_order_id is not null then
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta, promo_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta, p_promo_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    on conflict (order_id, type) where order_id is not null do nothing
    returning id into v_tx_id;
  elsif p_idempotency_key is not null then
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta, promo_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta, p_promo_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id into v_tx_id;
  else
    insert into public.wallet_transactions (
      account_id, user_id, type, pending_delta, available_delta, reserved_delta, promo_delta,
      order_id, listing_id, related_transaction_id, description, metadata, idempotency_key, created_by
    ) values (
      v_account_id, p_user_id, p_type, p_pending_delta, p_available_delta, p_reserved_delta, p_promo_delta,
      p_order_id, p_listing_id, p_related_transaction_id, p_description, p_metadata, p_idempotency_key, p_created_by
    )
    returning id into v_tx_id;
  end if;

  return query select v_tx_id, v_account_id, (v_tx_id is not null);
end;
$$;

revoke all on function public.record_wallet_transaction(
  uuid, text, integer, integer, integer, uuid, uuid, text, jsonb, text, uuid, uuid, integer
) from public;
grant execute on function public.record_wallet_transaction(
  uuid, text, integer, integer, integer, uuid, uuid, text, jsonb, text, uuid, uuid, integer
) to service_role;

-- ============================================================
-- 2. Referidos
-- ============================================================

alter table public.profiles
  add column if not exists referral_code text unique;

create table if not exists public.referrals (
  id                 uuid default gen_random_uuid() primary key,
  referrer_user_id   uuid references public.profiles(id) not null,
  referred_user_id   uuid references public.profiles(id) not null unique,
  referral_code      text not null,
  status             text not null default 'registered'
                       check (status in ('registered','qualified','rewarded','rejected')),
  qualified_at       timestamptz,
  rewarded_at        timestamptz,
  reward_transaction_id uuid references public.wallet_transactions(id),
  created_at         timestamptz not null default now(),
  constraint referrals_no_self_referral check (referrer_user_id <> referred_user_id)
);

comment on table public.referrals is
  'Una fila por usuaria referida (referred_user_id es unique — solo puede tener un referrer, ver sección 5 del encargo). El bono se acredita vía cron/referral-rewards, no en el mismo request de publicar (ver comentario en el trigger de abajo sobre por qué).';

create index if not exists referrals_referrer_user_id_idx on public.referrals (referrer_user_id);
create index if not exists referrals_status_idx on public.referrals (status);

alter table public.referrals enable row level security;

drop policy if exists "Referrer ve sus propios referidos" on public.referrals;
create policy "Referrer ve sus propios referidos" on public.referrals
  for select using (auth.uid() = referrer_user_id);
-- Sin policies de insert/update — la fila se crea desde handle_new_user
-- (trigger, security definer) y se actualiza desde el trigger de
-- calificación y el cron de recompensas (service_role). Nunca desde el
-- cliente directamente.

-- Extiende el trigger de creación de perfil (ya existía desde el schema
-- base) para registrar la relación de referido cuando la nueva usuaria se
-- registró con un link de invitación — options.data.referral_code en
-- supabase.auth.signUp() llega acá como raw_user_meta_data.
-- Auto-referido: estructuralmente imposible en este punto (new.id es
-- siempre un uuid recién creado — no puede coincidir con el id de un perfil
-- ya existente cuyo referral_code se está buscando), pero igual queda el
-- constraint referrals_no_self_referral como respaldo si esa suposición
-- cambiara alguna vez.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_referrer_id uuid;
  v_referral_code text;
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''));

  v_referral_code := new.raw_user_meta_data->>'referral_code';
  if v_referral_code is not null and v_referral_code <> '' then
    select id into v_referrer_id from public.profiles where referral_code = v_referral_code;
    if v_referrer_id is not null then
      insert into public.referrals (referrer_user_id, referred_user_id, referral_code)
      values (v_referrer_id, new.id, v_referral_code)
      on conflict (referred_user_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Detecta "primera publicación válida" (sección 3 del encargo): esta
-- marketplace no tiene borradores ni aprobación manual de listings — toda
-- fila que llega a existir en `listings` ya pasó la validación de la app y
-- nace con status='active' (ver ListingForm.tsx), así que "primera
-- publicación válida" = esta es la primera fila de listings de esta
-- vendedora. Deliberadamente NO se toca ListingForm.tsx ni el insert de
-- listings (sección 21 del encargo, "no tocar listings") — este trigger es
-- puramente aditivo y funciona sin importar qué código haga el insert.
--
-- Este trigger SOLO marca 'qualified' — no acredita el bono acá mismo. La
-- acreditación (con el chequeo del límite mensual) vive en TypeScript
-- (cron/referral-rewards, corre diario) para mantener la lógica de negocio
-- fuera de PL/pgSQL, igual que el resto del proyecto (el ledger en SQL es
-- solo el mecanismo de integridad, nunca dónde vive la regla de negocio) —
-- y para que sea testeable con los mismos mocks que el resto de wallet.ts.
create or replace function public.check_first_listing_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and not exists (select 1 from public.listings where seller_id = new.seller_id and id <> new.id)
  then
    update public.referrals
    set status = 'qualified', qualified_at = now()
    where referred_user_id = new.seller_id and status = 'registered';
  end if;
  return new;
end;
$$;

drop trigger if exists listings_check_referral_qualification on public.listings;
create trigger listings_check_referral_qualification
  after insert on public.listings
  for each row execute function public.check_first_listing_referral();

-- ============================================================
-- 3. Crédito promocional aplicado en el checkout
-- ============================================================

alter table public.orders
  add column if not exists promo_amount_applied integer not null default 0
    check (promo_amount_applied >= 0),
  add column if not exists promo_transaction_id uuid references public.wallet_transactions(id);

comment on column public.orders.promo_amount_applied is
  'Monto (CLP) del total cubierto con Crédito B-Dress (promocional) de la compradora — se aplica SIEMPRE antes que el saldo de ventas (ver payment/create/route.ts). Se fija una sola vez al crear el hold, igual que wallet_amount_applied.';
