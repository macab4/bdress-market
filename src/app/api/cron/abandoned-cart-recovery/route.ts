import { createAdminClient } from '@/lib/supabase/admin'
import { PENDING_ORDER_EXPIRY_MINUTES } from '@/lib/catalog'
import { sendAbandonedCartRecoveryEmail } from '@/lib/email'

const RECOVERY_WINDOW_DAYS = 14

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Manda un único
// recordatorio (nunca más de uno, gracias a abandoned_recovery_sent_at) a
// quien dejó una orden sin pagar — pending_payment ya vieja (usa
// PENDING_ORDER_EXPIRY_MINUTES para no molestar a alguien que sigue pagando
// ahora mismo) o cancelled sin haber llegado nunca a paid_at (rechazo de
// Mercado Pago o expiración del cron expire-pending-orders). Mismo patrón
// que review-followup: cutoff + columna "_sent_at" para no reenviar.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const pendingCutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString()
  const windowCutoff = new Date(Date.now() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, amount')
    .is('paid_at', null)
    .is('abandoned_recovery_sent_at', null)
    .gt('created_at', windowCutoff)
    .or(`and(status.eq.pending_payment,created_at.lt.${pendingCutoff}),status.eq.cancelled`)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!candidates || candidates.length === 0) {
    return Response.json({ sent: 0, skipped: 0 })
  }

  let sent = 0
  let skipped = 0

  await Promise.all(candidates.map(async (order) => {
    const [{ data: listing }, { data: buyer }] = await Promise.all([
      admin.from('listings').select('title, status').eq('id', order.listing_id).single(),
      admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    ])

    if (listing?.status === 'active' && buyer?.email) {
      await sendAbandonedCartRecoveryEmail({
        to: buyer.email,
        name: buyer.name,
        listingTitle: listing.title,
        listingId: order.listing_id,
        amount: order.amount,
      })
      sent++
    } else {
      skipped++
    }

    await admin.from('orders').update({ abandoned_recovery_sent_at: new Date().toISOString() }).eq('id', order.id)
  }))

  return Response.json({ sent, skipped })
}
