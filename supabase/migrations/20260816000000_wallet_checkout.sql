-- Saldo B-Dress (Fase 3) — pagar (parcial o total) en el checkout con saldo,
-- combinado con Mercado Pago por el resto. Agrega marketplace_purchase_hold/
-- cancelled (simétricos a withdrawal_hold/cancelled de fase 2) y columnas de
-- trazabilidad en orders para poder desglosar refunds mixtos (saldo +
-- Mercado Pago) sin ambigüedad.
--
-- Deliberadamente NO toca create_or_reuse_pending_order: la liberación de
-- una reserva de listing abandonada ya ocurre de forma atómica y perezosa
-- ahí mismo (ver comentario en expire-pending-orders/route.ts), sin esperar
-- al cron (que en el plan Hobby de Vercel solo corre 1 vez al día). Si esa
-- función bloqueara el "robo" de una reserva mientras hay saldo
-- comprometido, un listing quedaría invendible para cualquier otra
-- compradora hasta la próxima corrida del cron — un costo real de
-- inventario, no solo contable. En cambio, el cron diario libera cualquier
-- hold de saldo que haya quedado sin resolver (orden ya no está
-- pending_payment, o pasaron los mismos 30 minutos) — el único costo es que
-- el saldo de quien abandonó el checkout queda "reservado" en su propia
-- cuenta hasta la próxima corrida del cron, nunca bloquea el listing.

alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in (
    'sale_pending','sale_release','sale_reversal',
    'withdrawal_hold','withdrawal_completed','withdrawal_cancelled',
    'marketplace_purchase','marketplace_purchase_hold',
    'marketplace_purchase_cancelled','marketplace_purchase_refund',
    'giftcard_redemption','admin_credit','admin_debit'
  ));

alter table public.orders
  add column if not exists wallet_amount_applied integer not null default 0
    check (wallet_amount_applied >= 0),
  add column if not exists wallet_transaction_id uuid references public.wallet_transactions(id);

comment on column public.orders.wallet_amount_applied is
  'Monto (CLP) del total (prenda+protección+envío) cubierto con saldo B-Dress de la compradora. 0 si se pagó 100% con Mercado Pago. Se fija una sola vez al crear el hold — nunca se recalcula en reintentos (ver payment/create/route.ts).';
comment on column public.orders.wallet_transaction_id is
  'wallet_transactions.id del marketplace_purchase_hold que reservó el saldo — referencia para completar/cancelar/reembolsar exactamente ese monto, nunca recalculado.';
