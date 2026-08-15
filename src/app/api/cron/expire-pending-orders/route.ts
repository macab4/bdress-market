import { createAdminClient } from '@/lib/supabase/admin'
import { PENDING_ORDER_EXPIRY_MINUTES } from '@/lib/catalog'
import { recordPurchaseCancelled } from '@/lib/wallet'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). La liberación
// real de una reserva de LISTING abandonada ya ocurre de forma atómica y
// perezosa dentro de create_or_reuse_pending_order (supabase-schema.sql) la
// próxima vez que alguien intenta comprar esa prenda — este cron sigue
// siendo limpieza periódica para que las órdenes pending_payment
// abandonadas no queden dando vueltas indefinidamente en reportes/paneles.
//
// Desde fase 3 (saldo B-Dress), también libera cualquier hold de saldo
// (marketplace_purchase_hold) que haya quedado sin resolver — porque su
// orden expiró, o porque otra compradora se quedó con el listing y esta
// orden vieja quedó cancelled con un hold sin liberar. Deliberadamente NO
// se toca create_or_reuse_pending_order para esto (ver comentario en la
// migración 20260816000000_wallet_checkout.sql): bloquear ahí el "robo" de
// una reserva dejaría el listing invendible para cualquier otra compradora
// hasta la próxima corrida de este cron (Vercel Hobby: 1 vez al día) — un
// costo de inventario real. El único costo de esta forma es que el saldo de
// quien abandonó el checkout queda "reservado" en su propia cuenta hasta la
// próxima corrida del cron, nunca bloquea el listing para nadie más.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('created_at', cutoff)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Holds de saldo huérfanos: cualquier orden con saldo aplicado que no está
  // 'paid' (ya se resolvió en payment/confirm o payment/create) y que ya no
  // sigue activa como pending_payment reciente — cubre tanto las que este
  // mismo cron acaba de cancelar arriba como las que perdieron el listing
  // (robado por otra compradora) hace rato.
  const { data: ordersWithOrphanHold } = await admin
    .from('orders')
    .select('id, buyer_id, wallet_amount_applied, wallet_transaction_id')
    .gt('wallet_amount_applied', 0)
    .neq('status', 'paid')
    .lt('created_at', cutoff)

  let releasedHolds = 0
  for (const order of ordersWithOrphanHold ?? []) {
    // Idempotente por (order_id, type) — si ya se había liberado (ej. el
    // propio payment/create lo canceló ante un error de Mercado Pago), esto
    // es un no-op seguro.
    const result = await recordPurchaseCancelled(admin, {
      orderId: order.id,
      userId: order.buyer_id,
      amount: order.wallet_amount_applied,
      reason: 'order_abandoned_or_reassigned',
      holdTransactionId: order.wallet_transaction_id,
    })
    if (result.ok && !result.skipped) releasedHolds++
  }

  return Response.json({ expired: data?.length ?? 0, releasedHolds })
}
