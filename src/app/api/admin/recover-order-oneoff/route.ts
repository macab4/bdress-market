import { createAdminClient } from '@/lib/supabase/admin'
import { recordSalePending, sendWalletAlertEmail } from '@/lib/wallet'
import { finalizeOrderPaid } from '@/lib/orderNotifications'

// Ruta temporal de un solo uso — recupera la orden 7520a45f-5a8a-4195-bad9-07ea99f48c7f
// (vestido de Luz), pagada de verdad en Mercado Pago (payment id 184647951906,
// aprobado 2026-10-17T07:26:05-04:00) pero nunca confirmada acá porque el
// webhook falló en silencio (migración del carrito no corrida todavía,
// cart_checkout_id no existía). Replica exactamente lo que
// payment/confirm hace en el camino 'approved'. Se borra apenas se usa.
const ORDER_ID = '7520a45f-5a8a-4195-bad9-07ea99f48c7f'
const REAL_PAYMENT_ID = '184647951906'
const REAL_PAID_AT = '2026-10-17T11:26:05.000Z'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost, status, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
    .eq('id', ORDER_ID)
    .single()

  if (orderErr || !order) return Response.json({ error: orderErr?.message ?? 'orden no encontrada' }, { status: 404 })
  if (order.status !== 'cancelled') return Response.json({ error: `estado inesperado: ${order.status}, no se toca` }, { status: 409 })

  // La prenda se reactivó cuando el cron la canceló — confirmamos que sigue
  // libre antes de revivir la venta (si alguien ya la compró de nuevo, no
  // se puede volver a vender dos veces).
  const { data: listing } = await admin.from('listings').select('status').eq('id', order.listing_id).single()
  if (listing?.status !== 'active') return Response.json({ error: `la prenda ya no está active (status: ${listing?.status}) — no se puede revivir la orden` }, { status: 409 })

  const { error: updateErr } = await admin
    .from('orders')
    .update({ status: 'paid', payment_ref: REAL_PAYMENT_ID, paid_at: REAL_PAID_AT })
    .eq('id', ORDER_ID)
  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  await admin.from('listings').update({ status: 'sold' }).eq('id', order.listing_id)

  await admin.from('order_status_history').insert({
    order_id: ORDER_ID, previous_status: 'cancelled', new_status: 'paid',
    public_note: 'Recuperada manualmente — el pago sí se había aprobado en Mercado Pago, el webhook falló en silencio',
  })

  const pending = await recordSalePending(admin, {
    id: order.id, seller_id: order.seller_id, listing_id: order.listing_id,
    amount: order.amount, commission: order.commission, processing_fee: order.processing_fee,
  })
  if (!pending.ok) await sendWalletAlertEmail({ orderId: order.id, reason: pending.error })

  await finalizeOrderPaid(admin, {
    orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    amount: order.amount, commission: order.commission, processingFee: order.processing_fee, shippingCost: order.shipping_cost,
  })

  return Response.json({ ok: true })
}
