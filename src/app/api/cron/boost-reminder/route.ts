import { createAdminClient } from '@/lib/supabase/admin'
import { sendBoostReminderEmail } from '@/lib/email'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Sugiere
// destacar (ver /terminos "Destacar tu prenda") a vendedoras con una
// prenda activa que nunca se destacó (o dejó de estar destacada) —
// recordatorio RECURRENTE cada REMINDER_INTERVAL_DAYS mientras la prenda
// siga activa y sin destacar, no uno único (boost_reminder_sent_at,
// migración 20260831000000, ahora se lee como "último recordatorio
// mandado", no como "ya se mandó alguna vez").
const MIN_LISTING_AGE_DAYS = 14
const REMINDER_INTERVAL_DAYS = 14

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const ageCutoff = new Date(Date.now() - MIN_LISTING_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const reminderCutoff = new Date(Date.now() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('listings')
    .select('id, title, seller_id')
    .eq('status', 'active')
    .is('featured_until', null)
    .lt('created_at', ageCutoff)
    .or(`boost_reminder_sent_at.is.null,boost_reminder_sent_at.lt.${reminderCutoff}`)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!candidates || candidates.length === 0) {
    return Response.json({ sent: 0 })
  }

  const sellerIds = [...new Set(candidates.map(l => l.seller_id))]
  const { data: sellers } = await admin.from('profiles').select('id, name, email').in('id', sellerIds)
  const sellerMap = new Map((sellers ?? []).map(s => [s.id, s]))

  let sent = 0
  await Promise.all(candidates.map(async (listing) => {
    const seller = sellerMap.get(listing.seller_id)
    if (seller?.email) {
      await sendBoostReminderEmail({ to: seller.email, name: seller.name, listingTitle: listing.title, listingId: listing.id })
      sent++
    }
    await admin.from('listings').update({ boost_reminder_sent_at: new Date().toISOString() }).eq('id', listing.id)
  }))

  return Response.json({ sent, candidates: candidates.length })
}
