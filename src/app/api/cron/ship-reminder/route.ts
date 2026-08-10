import { createAdminClient } from '@/lib/supabase/admin'
import { sendShipReminderEmail } from '@/lib/email'
import { SHIP_DEADLINE_BUSINESS_DAYS } from '@/lib/catalog'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Manda un
// recordatorio TODOS LOS DÍAS mientras una orden nacional siga en 'paid'
// sin despachar — a diferencia de international-delay-check (un solo aviso
// por orden), acá se repite a propósito porque se pidió que insista día a
// día; last_ship_reminder_sent_at solo evita duplicar el envío si el cron
// corriera más de una vez el mismo día.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const oneDayAgoISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Órdenes nacionales (las internacionales las despacha la admin, siguen su
  // propio flujo en international-delay-check), pagadas hace más de un día
  // (el día 0 ya recibió el correo "¡Vendiste!"), sin recordatorio hoy.
  const { data: candidates, error } = await admin
    .from('orders')
    .select('id, seller_id, paid_at, listing:listings(title)')
    .eq('status', 'paid')
    .is('international_status', null)
    .not('paid_at', 'is', null)
    .lt('paid_at', oneDayAgoISO)
    .or(`last_ship_reminder_sent_at.is.null,last_ship_reminder_sent_at.lt.${oneDayAgoISO}`)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  type Candidate = { id: string; seller_id: string; paid_at: string; listing: { title: string } | { title: string }[] | null }
  const rows = (candidates ?? []) as unknown as Candidate[]

  let sent = 0
  await Promise.all(rows.map(async (order) => {
    const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing
    const daysElapsed = Math.floor((Date.now() - new Date(order.paid_at).getTime()) / (24 * 60 * 60 * 1000))

    const { data: seller } = await admin.from('profiles').select('email, name').eq('id', order.seller_id).single()
    if (seller?.email) {
      await sendShipReminderEmail({
        to: seller.email,
        name: seller.name,
        listingTitle: listing?.title ?? 'tu prenda',
        daysElapsed,
        deadlineDays: SHIP_DEADLINE_BUSINESS_DAYS,
      })
      sent++
    }
    await admin.from('orders').update({ last_ship_reminder_sent_at: new Date().toISOString() }).eq('id', order.id)
  }))

  return Response.json({ sent })
}
