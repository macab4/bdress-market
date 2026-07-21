import { createAdminClient } from '@/lib/supabase/admin'
import { CONFIRMED_HOLD_DAYS, SHIPPED_FALLBACK_DAYS } from '@/lib/catalog'
import { sendReviewReminderEmail } from '@/lib/email'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// No mueve plata real, solo marca la orden como "completed" (el pago a
// la vendedora ya sigue siendo manual).
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

  const releasedIds = [
    ...(confirmedResult.data ?? []).map(o => o.id),
    ...(shippedResult.data ?? []).map(o => o.id),
  ]

  if (releasedIds.length > 0) {
    const { data: releasedOrders } = await admin
      .from('orders')
      .select('buyer_id, seller_id, listing_id')
      .in('id', releasedIds)

    await Promise.all((releasedOrders ?? []).map(async (order) => {
      const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
        admin.from('listings').select('title').eq('id', order.listing_id).single(),
        admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
        admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
      ])
      const listingTitle = listing?.title ?? 'esta prenda'
      await Promise.all([
        buyer?.email
          ? sendReviewReminderEmail({ to: buyer.email, name: buyer.name, listingTitle, role: 'buyer' })
          : Promise.resolve(),
        seller?.email
          ? sendReviewReminderEmail({ to: seller.email, name: seller.name, listingTitle, role: 'seller' })
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
