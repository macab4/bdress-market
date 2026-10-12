import { createAdminClient } from '@/lib/supabase/admin'
import { executeOrderRefund } from '@/lib/orderNotifications'

// Ruta temporal de un solo uso — cancela 2 órdenes de prueba entre cuentas
// de prueba de la propia usuaria (Bdress / Macabz) sin aplicar la
// penalización de 1 estrella, reusando la lógica real de reembolso en vez
// de replicarla a mano. Se borra apenas se usa.
const TEST_ORDER_IDS = ['c68189e2-1553-42b8-9a09-a19874d2ee71', 'cb9c5bfa-3071-434f-b206-a46489991603']

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const results: Record<string, unknown> = {}

  for (const orderId of TEST_ORDER_IDS) {
    const { data: order } = await admin
      .from('orders')
      .select('id, listing_id, buyer_id, seller_id, status, payment_ref, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
      .eq('id', orderId)
      .single()

    if (!order) { results[orderId] = { error: 'no encontrada' }; continue }
    if (order.status !== 'paid') { results[orderId] = { skipped: `status ya es ${order.status}` }; continue }

    // La única que queda (Bolso mano mostacillas) tiene un payment_ref real
    // de Mercado Pago de hace más de un mes que MP ya no deja reembolsar, y
    // no tiene saldo de wallet aplicado (wallet_amount_applied: 0) — así que
    // no hace falta pasar por el reembolso de MP ni por ninguna reversa de
    // saldo, solo cerrar la orden y reactivar la prenda.
    const result = order.wallet_amount_applied === 0
      ? await (async () => {
          await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
          await admin.from('listings').update({ status: 'active' }).eq('id', order.listing_id)
          return { ok: true, note: 'cerrada sin reembolso de MP (sin saldo de wallet involucrado)' }
        })()
      : await executeOrderRefund(admin, {
          orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
          paymentRef: order.payment_ref, walletAmountApplied: order.wallet_amount_applied, walletTransactionId: order.wallet_transaction_id,
          promoAmountApplied: order.promo_amount_applied, promoTransactionId: order.promo_transaction_id,
        }, {
          createdBy: null,
          reversalDescription: 'Reverso — orden de prueba eliminada por la administradora',
          walletRefundReason: 'test_order_cleanup',
        })

    results[orderId] = result
  }

  return Response.json(results)
}
