import { createAdminClient } from '@/lib/supabase/admin'
import { executeOrderRefund, sendSystemMessage } from '@/lib/orderNotifications'
import { SHIP_DEADLINE_BUSINESS_DAYS } from '@/lib/catalog'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). El email de
// confirmación de compra (finalizeOrderPaid) ya le promete a la compradora
// "si no la despacha a tiempo, cancelamos la compra y te reembolsamos el
// pago completo" — esto es lo que cumple esa promesa, que hasta ahora no
// tenía ningún cron detrás (ship-reminder solo manda recordatorios, nunca
// cancela). Solo nacional: las internacionales las despacha la admin y
// siguen su propio flujo en international-delay-check.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const deadlineCutoffISO = new Date(Date.now() - SHIP_DEADLINE_BUSINESS_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, payment_ref, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
    .eq('status', 'paid')
    .is('international_status', null)
    .not('paid_at', 'is', null)
    .lt('paid_at', deadlineCutoffISO)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let cancelled = 0
  let failed = 0

  for (const order of candidates ?? []) {
    const result = await executeOrderRefund(admin, {
      orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
      paymentRef: order.payment_ref, walletAmountApplied: order.wallet_amount_applied, walletTransactionId: order.wallet_transaction_id,
      promoAmountApplied: order.promo_amount_applied, promoTransactionId: order.promo_transaction_id,
    }, {
      createdBy: null,
      reversalDescription: `Reverso automático — venta cancelada por atraso en el despacho (más de ${SHIP_DEADLINE_BUSINESS_DAYS} días)`,
      walletRefundReason: 'late_shipment_auto_cancelled',
      sellerAtFault: { reviewComment: 'Calificación automática: la vendedora no despachó la prenda dentro del plazo.' },
    })

    if (!result.ok) {
      console.error(`auto-cancel-late-shipments: no se pudo cancelar la orden ${order.id}:`, result.error)
      failed++
      continue
    }

    await sendSystemMessage(admin, {
      listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
      content: `Esta venta se canceló automáticamente porque la vendedora no la despachó dentro de los ${SHIP_DEADLINE_BUSINESS_DAYS} días hábiles del plazo. Tu pago fue reembolsado por completo.`,
    })
    cancelled++
  }

  return Response.json({ cancelled, failed })
}
