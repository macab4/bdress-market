import { createAdminClient } from '@/lib/supabase/admin'
import { REVIEW_FOLLOWUP_DAYS } from '@/lib/catalog'
import { sendReviewReminderEmail } from '@/lib/email'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// A los REVIEW_FOLLOWUP_DAYS de completada la orden, si alguna de las dos
// partes todavía no dejó su reseña, le manda un único recordatorio de
// seguimiento (nunca más de uno por lado, gracias a *_review_reminded_at).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - REVIEW_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, buyer_review_reminded_at, seller_review_reminded_at')
    .eq('status', 'completed')
    .lt('completed_at', cutoff)
    .or('buyer_review_reminded_at.is.null,seller_review_reminded_at.is.null')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!candidates || candidates.length === 0) {
    return Response.json({ remindedBuyers: 0, remindedSellers: 0 })
  }

  const { data: existingReviews } = await admin
    .from('reviews')
    .select('order_id, reviewer_id')
    .in('order_id', candidates.map(o => o.id))
  const reviewedBy = new Set((existingReviews ?? []).map(r => `${r.order_id}:${r.reviewer_id}`))

  let remindedBuyers = 0
  let remindedSellers = 0

  await Promise.all(candidates.map(async (order) => {
    const needsBuyerReminder = !order.buyer_review_reminded_at && !reviewedBy.has(`${order.id}:${order.buyer_id}`)
    const needsSellerReminder = !order.seller_review_reminded_at && !reviewedBy.has(`${order.id}:${order.seller_id}`)
    if (!needsBuyerReminder && !needsSellerReminder) return

    const [{ data: listing }, buyerProfile, sellerProfile] = await Promise.all([
      admin.from('listings').select('title').eq('id', order.listing_id).single(),
      needsBuyerReminder
        ? admin.from('profiles').select('email, name').eq('id', order.buyer_id).single()
        : Promise.resolve({ data: null }),
      needsSellerReminder
        ? admin.from('profiles').select('email, name').eq('id', order.seller_id).single()
        : Promise.resolve({ data: null }),
    ])
    const listingTitle = listing?.title ?? 'esta prenda'
    const update: Record<string, string> = {}

    if (needsBuyerReminder) {
      if (buyerProfile.data?.email) {
        await sendReviewReminderEmail({ to: buyerProfile.data.email, name: buyerProfile.data.name, listingTitle, role: 'buyer', followup: true })
        remindedBuyers++
      }
      update.buyer_review_reminded_at = new Date().toISOString()
    }
    if (needsSellerReminder) {
      if (sellerProfile.data?.email) {
        await sendReviewReminderEmail({ to: sellerProfile.data.email, name: sellerProfile.data.name, listingTitle, role: 'seller', followup: true })
        remindedSellers++
      }
      update.seller_review_reminded_at = new Date().toISOString()
    }

    await admin.from('orders').update(update).eq('id', order.id)
  }))

  return Response.json({ remindedBuyers, remindedSellers })
}
