import { createAdminClient } from '@/lib/supabase/admin'
import { sendInternationalDelayNoticeEmail } from '@/lib/email'
import { isPastEstimatedDelivery } from '@/lib/international/status'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Si una orden
// internacional pasó el plazo máximo estimado sin llegar a "delivered" (ni
// estar cancelada/reembolsada), manda un único aviso de demora — nunca más
// de uno por orden, gracias a delay_notice_sent_at.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, buyer_id, paid_at, international_status, listing:listings(title, international_lead_time_max_days)')
    .not('international_status', 'is', null)
    .not('paid_at', 'is', null)
    .is('delay_notice_sent_at', null)
    .not('international_status', 'in', '(delivered,refunded,cancellation_pending,source_unavailable)')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  type Candidate = { id: string; buyer_id: string; paid_at: string; international_status: string; listing: { title: string; international_lead_time_max_days: number | null } | { title: string; international_lead_time_max_days: number | null }[] | null }
  const rows = (candidates ?? []) as unknown as Candidate[]

  let notified = 0
  await Promise.all(rows.map(async (order) => {
    const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing
    if (!isPastEstimatedDelivery(order.paid_at, listing?.international_lead_time_max_days, order.international_status as never)) return

    const { data: buyer } = await admin.from('profiles').select('email, name').eq('id', order.buyer_id).single()
    if (buyer?.email) {
      await sendInternationalDelayNoticeEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? 'tu prenda' })
      notified++
    }
    await admin.from('orders').update({ delay_notice_sent_at: new Date().toISOString() }).eq('id', order.id)
  }))

  return Response.json({ notified })
}
