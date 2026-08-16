import { createAdminClient } from '@/lib/supabase/admin'
import { CONFIRMED_HOLD_DAYS, SHIPPED_FALLBACK_DAYS } from '@/lib/catalog'
import { sendReviewReminderEmail, sendWalletBalanceChangedEmail } from '@/lib/email'
import { recordSaleRelease, orderNetAmount, sendWalletAlertEmail } from '@/lib/wallet'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// Marca la orden como "completed" y libera el saldo pendiente de la
// vendedora a disponible (ver src/lib/wallet.ts) — el "monto neto" ya quedó
// fijo desde que se creó el sale_pending en payment/confirm, acá no se
// recalcula nada.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const confirmedCutoff = new Date(Date.now() - CONFIRMED_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const shippedCutoff = new Date(Date.now() - SHIPPED_FALLBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const completedAt = new Date().toISOString()

  const [confirmedResult, shippedResult] = await Promise.all([
    admin
      .from('orders')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('status', 'delivered')
      .lt('confirmed_at', confirmedCutoff)
      .select('id'),
    admin
      .from('orders')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('status', 'shipped')
      .lt('shipped_at', shippedCutoff)
      .select('id'),
  ])

  if (confirmedResult.error) return Response.json({ error: confirmedResult.error.message }, { status: 500 })
  if (shippedResult.error) return Response.json({ error: shippedResult.error.message }, { status: 500 })

  const confirmedIds = new Set((confirmedResult.data ?? []).map(o => o.id))
  const releasedIds = [
    ...(confirmedResult.data ?? []).map(o => o.id),
    ...(shippedResult.data ?? []).map(o => o.id),
  ]

  if (releasedIds.length > 0) {
    const { data: releasedOrders } = await admin
      .from('orders')
      .select('id, buyer_id, seller_id, listing_id, amount, commission, processing_fee')
      .in('id', releasedIds)

    await Promise.all((releasedOrders ?? []).map(async (order) => {
      const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
        admin.from('listings').select('title').eq('id', order.listing_id).single(),
        admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
        admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
      ])
      const listingTitle = listing?.title ?? 'esta prenda'

      const source = confirmedIds.has(order.id) ? 'cron_confirmed_hold' : 'cron_shipped_fallback'
      const release = await recordSaleRelease(admin, order.id, {
        source,
        description: `Venta liberada — ${listingTitle}`,
      })
      if (!release.ok) await sendWalletAlertEmail({ orderId: order.id, reason: release.error })

      await Promise.all([
        buyer?.email
          ? sendReviewReminderEmail({ to: buyer.email, name: buyer.name, listingTitle, role: 'buyer' })
          : Promise.resolve(),
        seller?.email
          ? sendReviewReminderEmail({ to: seller.email, name: seller.name, listingTitle, role: 'seller' })
          : Promise.resolve(),
        seller?.email && release.ok
          ? sendWalletBalanceChangedEmail({
              to: seller.email, name: seller.name, amount: orderNetAmount(order),
              reason: `Venta liberada — ${listingTitle}`,
            })
          : Promise.resolve(),
      ])
    }))
  }

  return Response.json({
    released: (confirmedResult.data?.length ?? 0) + (shippedResult.data?.length ?? 0),
    fromConfirmedHold: confirmedResult.data?.length ?? 0,
    fromShippedFallback: shippedResult.data?.length ?? 0,
  })
}
