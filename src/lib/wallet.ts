import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import type { WalletTransactionType } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

// Única fuente de los nombres en español de cada tipo de movimiento — usada
// tanto en /dashboard/wallet (compradora/vendedora) como en /admin/wallet.
// Antes vivía duplicado en los dos archivos; ya casi quedan desincronizados
// cuando se agregaron marketplace_purchase_hold/cancelled en fase 3.
export const WALLET_TRANSACTION_TYPE_LABELS: Record<WalletTransactionType, string> = {
  sale_pending: 'Venta pendiente',
  sale_release: 'Venta liberada',
  sale_reversal: 'Reverso de venta',
  withdrawal_hold: 'Retiro solicitado',
  withdrawal_completed: 'Retiro completado',
  withdrawal_cancelled: 'Retiro cancelado',
  marketplace_purchase: 'Compra con saldo',
  marketplace_purchase_hold: 'Saldo reservado para una compra',
  marketplace_purchase_cancelled: 'Reserva de compra liberada',
  marketplace_purchase_refund: 'Reembolso de compra',
  giftcard_redemption: 'Gift Card',
  admin_credit: 'Ajuste — crédito',
  admin_debit: 'Ajuste — débito',
}

// Monto neto que le corresponde a la vendedora por una orden — usa las
// columnas ya persistidas en `orders` (congeladas al crear la orden) en vez
// de recalcular con sellerPayout()/paymentProcessingFee() de catalog.ts. Es
// matemáticamente idéntico (amount = price + commission), pero así, si la
// fórmula de fees cambia en el futuro, las órdenes viejas no se ven
// afectadas — el neto de una orden queda fijo desde que se creó, mucho antes
// de que exista el wallet.
export function orderNetAmount(order: { amount: number; commission: number; processing_fee: number }): number {
  return order.amount - order.commission - order.processing_fee
}

interface RpcRow { transaction_id: string | null; account_id: string | null; inserted: boolean }
type RecordResult =
  | { ok: true; skipped: boolean; transactionId?: string }
  | { ok: false; error: string }

async function callRecordTransaction(admin: AdminClient, args: Record<string, unknown>): Promise<RecordResult> {
  const { data, error } = await admin.rpc('record_wallet_transaction', args)
  if (error) return { ok: false, error: error.message }
  const row = (data as RpcRow[] | null)?.[0]
  return { ok: true, skipped: !row?.inserted, transactionId: row?.transaction_id ?? undefined }
}

// Forma común a recordWithdrawalHold y recordPurchaseHold: comprometer
// saldo de inmediato, disponible → reservado, atómicamente (si el check
// available_balance >= 0 falla por una carrera, el RPC devuelve error y el
// llamador nunca llega a persistir el efecto secundario — fila `withdrawals`
// o `orders.wallet_amount_applied`, según el caso).
async function moveAvailableToReserved(admin: AdminClient, args: {
  userId: string; type: WalletTransactionType; amount: number
  orderId?: string; description: string; metadata?: Record<string, unknown>; idempotencyKey?: string
}): Promise<RecordResult> {
  return callRecordTransaction(admin, {
    p_user_id: args.userId,
    p_type: args.type,
    p_pending_delta: 0,
    p_available_delta: -args.amount,
    p_reserved_delta: args.amount,
    p_order_id: args.orderId,
    p_description: args.description,
    p_metadata: args.metadata,
    p_idempotency_key: args.idempotencyKey,
  })
}

// Forma común a completar/cancelar tanto un retiro como una compra con
// saldo: resuelve lo reservado, ya sea gastándolo definitivamente
// (returnToAvailable: false) o devolviéndolo a disponible
// (returnToAvailable: true).
async function releaseReserved(admin: AdminClient, args: {
  userId: string; type: WalletTransactionType; amount: number; returnToAvailable: boolean
  orderId?: string; description: string; metadata?: Record<string, unknown>
  idempotencyKey?: string; relatedTransactionId?: string | null; createdBy?: string | null
}): Promise<RecordResult> {
  return callRecordTransaction(admin, {
    p_user_id: args.userId,
    p_type: args.type,
    p_pending_delta: 0,
    p_available_delta: args.returnToAvailable ? args.amount : 0,
    p_reserved_delta: -args.amount,
    p_order_id: args.orderId,
    p_description: args.description,
    p_metadata: args.metadata,
    p_idempotency_key: args.idempotencyKey,
    p_related_transaction_id: args.relatedTransactionId ?? null,
    p_created_by: args.createdBy ?? null,
  })
}

// Se crea cuando la orden pasa a 'paid' (el dinero existe pero está
// retenido — todavía no es de la vendedora hasta que la venta se complete).
// Idempotente por (order_id, type): si el webhook de Mercado Pago reintenta,
// no se duplica.
export async function recordSalePending(admin: AdminClient, order: {
  id: string; seller_id: string; listing_id: string; amount: number; commission: number; processing_fee: number
}): Promise<RecordResult> {
  const net = orderNetAmount(order)
  return callRecordTransaction(admin, {
    p_user_id: order.seller_id,
    p_type: 'sale_pending' satisfies WalletTransactionType,
    p_pending_delta: net,
    p_available_delta: 0,
    p_reserved_delta: 0,
    p_order_id: order.id,
    p_listing_id: order.listing_id,
    p_description: 'Venta pendiente de liberación',
  })
}

async function findSalePending(admin: AdminClient, orderId: string) {
  const { data } = await admin
    .from('wallet_transactions')
    .select('id, user_id, listing_id, pending_delta')
    .eq('order_id', orderId)
    .eq('type', 'sale_pending')
    .maybeSingle()
  return data as { id: string; user_id: string; listing_id: string | null; pending_delta: number } | null
}

// Libera una venta (orden pasó a 'completed'): mueve el monto de pendiente a
// disponible. Reusa el pending_delta de la fila sale_pending original tal
// cual — nunca recalcula — para no depender de que amount/commission/
// processing_fee de la orden no hayan cambiado desde entonces.
export async function recordSaleRelease(
  admin: AdminClient, orderId: string,
  opts: { source: string; description?: string; createdBy?: string | null }
): Promise<RecordResult & { reason?: string }> {
  const original = await findSalePending(admin, orderId)
  if (!original) return { ok: true, skipped: true, reason: 'no_sale_pending_found' }

  return callRecordTransaction(admin, {
    p_user_id: original.user_id,
    p_type: 'sale_release' satisfies WalletTransactionType,
    p_pending_delta: -original.pending_delta,
    p_available_delta: original.pending_delta,
    p_reserved_delta: 0,
    p_order_id: orderId,
    p_listing_id: original.listing_id,
    p_description: opts.description ?? 'Venta liberada',
    p_metadata: { source: opts.source },
    p_related_transaction_id: original.id,
    p_created_by: opts.createdBy ?? null,
  })
}

// Reversa una venta pendiente que se canceló/reembolsó antes de liberarse
// (admin resuelve 'refund'). Fila nueva de signo contrario — nunca se muta
// la fila sale_pending original (ver comentario de inmutabilidad en la
// migración).
export async function recordSaleReversal(
  admin: AdminClient, orderId: string,
  opts: { description?: string; createdBy?: string | null }
): Promise<RecordResult & { reason?: string }> {
  const original = await findSalePending(admin, orderId)
  if (!original) return { ok: true, skipped: true, reason: 'no_sale_pending_found' }

  return callRecordTransaction(admin, {
    p_user_id: original.user_id,
    p_type: 'sale_reversal' satisfies WalletTransactionType,
    p_pending_delta: -original.pending_delta,
    p_available_delta: 0,
    p_reserved_delta: 0,
    p_order_id: orderId,
    p_listing_id: original.listing_id,
    p_description: opts.description ?? 'Reverso por reembolso de la compradora',
    p_metadata: { source: 'admin_refund' },
    p_related_transaction_id: original.id,
    p_created_by: opts.createdBy ?? null,
  })
}

// Ajuste manual — únicamente desde /admin/wallet, nunca desde flujos
// automáticos. idempotencyKey la genera el llamador (server-side, una vez
// por submit) para que un doble-envío no duplique el ajuste.
export async function recordAdminAdjustment(admin: AdminClient, args: {
  userId: string; type: 'admin_credit' | 'admin_debit'; amount: number; reason: string
  idempotencyKey: string; createdBy: string
}): Promise<RecordResult> {
  const signedAmount = args.type === 'admin_credit' ? Math.abs(args.amount) : -Math.abs(args.amount)
  return callRecordTransaction(admin, {
    p_user_id: args.userId,
    p_type: args.type,
    p_pending_delta: 0,
    p_available_delta: signedAmount,
    p_reserved_delta: 0,
    p_description: args.reason,
    p_idempotency_key: args.idempotencyKey,
    p_created_by: args.createdBy,
  })
}

// Se crea al confirmar la solicitud de retiro: mueve el monto de disponible
// a reservado, atómicamente. Si el check available_balance >= 0 falla por
// una carrera con otro retiro/gasto, el RPC devuelve error y el llamador
// (api/wallet/withdrawals) nunca llega a insertar la fila en `withdrawals`.
// idempotency_key por id de retiro (generado por el llamador ANTES de este
// call) — un doble-submit del form no duplica la reserva.
export async function recordWithdrawalHold(admin: AdminClient, args: {
  withdrawalId: string; userId: string; amount: number
}): Promise<RecordResult> {
  return moveAvailableToReserved(admin, {
    userId: args.userId,
    type: 'withdrawal_hold' satisfies WalletTransactionType,
    amount: args.amount,
    description: 'Retiro solicitado — saldo reservado',
    metadata: { withdrawal_id: args.withdrawalId },
    idempotencyKey: `withdrawal_hold:${args.withdrawalId}`,
  })
}

// Admin marca el retiro como transferido: la plata sale del sistema, nunca
// vuelve a disponible. idempotency_key por id de retiro — esto es lo que
// impide que la admin complete dos veces el mismo retiro incluso con
// doble-click, a nivel de base de datos.
export async function recordWithdrawalCompleted(admin: AdminClient, args: {
  withdrawalId: string; userId: string; amount: number; createdBy: string
}): Promise<RecordResult> {
  return releaseReserved(admin, {
    userId: args.userId,
    type: 'withdrawal_completed' satisfies WalletTransactionType,
    amount: args.amount,
    returnToAvailable: false,
    description: 'Retiro transferido',
    metadata: { withdrawal_id: args.withdrawalId },
    idempotencyKey: `withdrawal_completed:${args.withdrawalId}`,
    createdBy: args.createdBy,
  })
}

// Admin rechaza el retiro: el saldo reservado vuelve a disponible.
export async function recordWithdrawalCancelled(admin: AdminClient, args: {
  withdrawalId: string; userId: string; amount: number; reason: string; createdBy: string
}): Promise<RecordResult> {
  return releaseReserved(admin, {
    userId: args.userId,
    type: 'withdrawal_cancelled' satisfies WalletTransactionType,
    amount: args.amount,
    returnToAvailable: true,
    description: args.reason,
    metadata: { withdrawal_id: args.withdrawalId },
    idempotencyKey: `withdrawal_cancelled:${args.withdrawalId}`,
    createdBy: args.createdBy,
  })
}

// Caso borde: el hold tuvo éxito (la plata ya está reservada en el ledger)
// pero el INSERT de la fila `withdrawals` falló después — requiere
// corrección manual (buscar la wallet_transaction por
// metadata.withdrawal_id).
export async function sendWithdrawalAlertEmail(args: { withdrawalId: string; reason: string }) {
  if (!process.env.ADMIN_EMAIL) return
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `Alerta retiro B-Dress — ${args.withdrawalId}`,
    html: emailLayout('Alerta de retiro', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        El retiro <strong>${args.withdrawalId}</strong> reservó saldo en el ledger pero no se pudo crear/actualizar su fila: <strong>${args.reason}</strong>.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Requiere revisión manual en wallet_transactions (metadata.withdrawal_id) y en la tabla withdrawals.
      </p>
    `),
  })
}

// Si un record* falla DESPUÉS de que orders.status ya cambió, no se revierte
// el estado de la orden (más riesgoso que dejarlo así) — se avisa a la admin
// para una corrección manual vía ajuste (recordAdminAdjustment).
export async function sendWalletAlertEmail(args: { orderId: string; reason: string }) {
  if (!process.env.ADMIN_EMAIL) return
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `Alerta saldo B-Dress — orden ${args.orderId}`,
    html: emailLayout('Alerta de saldo', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        La orden <strong>${args.orderId}</strong> cambió de estado pero el movimiento de saldo falló: <strong>${args.reason}</strong>.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Requiere revisión manual — probablemente un ajuste de saldo (crédito/débito) desde /admin/wallet.
      </p>
    `),
  })
}

// Se crea al confirmar el checkout con saldo aplicado (parcial o total):
// mueve el monto de disponible a reservado — el dinero se compromete de
// inmediato, antes de saber si el resto (si lo hay) se paga por Mercado
// Pago. idempotency_key por id de orden, generado ANTES de este call —
// un reintento del checkout sobre la misma orden pending_payment no
// duplica la reserva.
export async function recordPurchaseHold(admin: AdminClient, args: {
  orderId: string; userId: string; amount: number
}): Promise<RecordResult> {
  return moveAvailableToReserved(admin, {
    userId: args.userId,
    type: 'marketplace_purchase_hold' satisfies WalletTransactionType,
    amount: args.amount,
    orderId: args.orderId,
    description: 'Saldo aplicado a una compra',
  })
}

// La orden quedó 'paid' (ya sea 100% con saldo o pago mixto confirmado por
// Mercado Pago): el hold se vuelve gasto definitivo, nunca vuelve a
// disponible. `amount` siempre es el del hold original — nunca se
// recalcula (ver comentario de wallet_amount_applied en la migración).
export async function recordPurchaseCompleted(admin: AdminClient, args: {
  orderId: string; userId: string; amount: number; holdTransactionId?: string | null; createdBy?: string | null
}): Promise<RecordResult> {
  return releaseReserved(admin, {
    userId: args.userId,
    type: 'marketplace_purchase' satisfies WalletTransactionType,
    amount: args.amount,
    returnToAvailable: false,
    orderId: args.orderId,
    description: 'Compra pagada con saldo',
    relatedTransactionId: args.holdTransactionId,
    createdBy: args.createdBy,
  })
}

// La orden se abandonó/canceló sin pagar (cron expire-pending-orders): el
// saldo reservado vuelve a disponible.
export async function recordPurchaseCancelled(admin: AdminClient, args: {
  orderId: string; userId: string; amount: number; reason: string; holdTransactionId?: string | null; createdBy?: string | null
}): Promise<RecordResult> {
  return releaseReserved(admin, {
    userId: args.userId,
    type: 'marketplace_purchase_cancelled' satisfies WalletTransactionType,
    amount: args.amount,
    returnToAvailable: true,
    orderId: args.orderId,
    description: args.reason,
    relatedTransactionId: args.holdTransactionId,
    createdBy: args.createdBy,
  })
}

// Admin reembolsa una orden ya pagada que incluía saldo — devuelve la parte
// de saldo a disponible (la parte de Mercado Pago se reembolsa aparte, vía
// su propio payment_ref, en admin/orders/[id]/resolve).
export async function recordPurchaseRefund(admin: AdminClient, args: {
  orderId: string; userId: string; amount: number; reason: string; holdTransactionId?: string | null; createdBy?: string | null
}): Promise<RecordResult> {
  return callRecordTransaction(admin, {
    p_user_id: args.userId,
    p_type: 'marketplace_purchase_refund' satisfies WalletTransactionType,
    p_pending_delta: 0,
    p_available_delta: args.amount,
    p_reserved_delta: 0,
    p_order_id: args.orderId,
    p_description: args.reason,
    p_related_transaction_id: args.holdTransactionId ?? null,
    p_created_by: args.createdBy ?? null,
  })
}

// Cuánto del total puede cubrirse con saldo — nunca confía en el monto que
// pide el cliente: lo capea al disponible real (leído server-side) y al
// total de la orden. Nunca negativo.
export function computeWalletApplication(args: {
  totalAmount: number; availableBalance: number; requestedAmount: number
}): number {
  const requested = Math.max(0, Math.round(args.requestedAmount) || 0)
  return Math.min(requested, Math.max(0, args.availableBalance), Math.max(0, args.totalAmount))
}

// Arma los ítems de la preferencia de Mercado Pago por lo que falta cubrir
// después de aplicar el saldo — resta secuencial (Prenda → Protección
// BDress → Envío), nunca negativa, ítems en $0 se filtran. Evita depender
// de si Mercado Pago acepta unit_price negativo o en cero (no verificado).
export function prorateMercadoPagoItems(args: {
  price: number; commission: number; shippingCost: number; walletAmountApplied: number
}): { title: string; unitPrice: number }[] {
  let remaining = args.walletAmountApplied
  function take(amount: number): number {
    const deducted = Math.min(remaining, amount)
    remaining -= deducted
    return amount - deducted
  }
  const items = [
    { title: 'Prenda', unitPrice: take(args.price) },
    { title: 'Protección BDress', unitPrice: take(args.commission) },
    { title: 'Envío', unitPrice: take(args.shippingCost) },
  ]
  return items.filter(item => item.unitPrice > 0)
}

export async function getWalletSummary(admin: AdminClient, userId: string) {
  const { data } = await admin
    .from('wallet_accounts')
    .select('available_balance, pending_balance, reserved_balance')
    .eq('user_id', userId)
    .maybeSingle()
  return data ?? { available_balance: 0, pending_balance: 0, reserved_balance: 0 }
}
