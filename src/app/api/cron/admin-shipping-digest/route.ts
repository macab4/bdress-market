import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminShippingDigestEmail } from '@/lib/email'
import { shipDeadline, ADMIN_SHIPPED_REVIEW_DAYS } from '@/lib/catalog'

const DAY_MS = 24 * 60 * 60 * 1000

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Junta, para
// órdenes nacionales (las internacionales las maneja la admin por su propio
// carril, ver admin/international), todo lo que hoy depende de que la
// vendedora o la compradora vuelvan a entrar a la app — algo que en la
// práctica no siempre pasa aunque el despacho/entrega ya haya ocurrido de
// verdad (ver comentario en api/admin/orders/[id]/mark-shipped) — para que
// la admin pueda revisarlo con el seguimiento real del courier y marcarlo
// ella misma en vez de depender de que alguna de las dos actúe.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }
  if (!process.env.ADMIN_EMAIL) return Response.json({ sent: false, reason: 'no_admin_email' })

  const admin = createAdminClient()
  const now = Date.now()

  type PaidRow = { id: string; paid_at: string; seller: { name: string } | { name: string }[] | null; listing: { title: string } | { title: string }[] | null }
  const { data: paidCandidates } = await admin
    .from('orders')
    .select('id, paid_at, seller:profiles!orders_seller_id_fkey(name), listing:listings(title)')
    .eq('status', 'paid')
    .is('international_status', null)
    .not('paid_at', 'is', null) as unknown as { data: PaidRow[] | null }

  const awaitingDispatch = (paidCandidates ?? [])
    .map(order => {
      const deadline = shipDeadline(order.paid_at)
      const daysOverdue = Math.floor((now - deadline.getTime()) / DAY_MS)
      const seller = Array.isArray(order.seller) ? order.seller[0] : order.seller
      const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing
      return { orderId: order.id, listingTitle: listing?.title ?? 'Prenda eliminada', sellerName: seller?.name ?? null, daysOverdue }
    })
    .filter(o => o.daysOverdue > 0)

  type ShippedRow = {
    id: string; shipped_at: string; tracking_number: string | null; label_tracking_number: string | null
    buyer: { name: string } | { name: string }[] | null; listing: { title: string } | { title: string }[] | null
  }
  const { data: shippedCandidates } = await admin
    .from('orders')
    .select('id, shipped_at, tracking_number, label_tracking_number, buyer:profiles!orders_buyer_id_fkey(name), listing:listings(title)')
    .eq('status', 'shipped')
    .is('international_status', null)
    .not('shipped_at', 'is', null) as unknown as { data: ShippedRow[] | null }

  const awaitingDeliveryConfirmation = (shippedCandidates ?? [])
    .map(order => {
      const daysSinceShipped = Math.floor((now - new Date(order.shipped_at).getTime()) / DAY_MS)
      const buyer = Array.isArray(order.buyer) ? order.buyer[0] : order.buyer
      const listing = Array.isArray(order.listing) ? order.listing[0] : order.listing
      return {
        orderId: order.id, listingTitle: listing?.title ?? 'Prenda eliminada', buyerName: buyer?.name ?? null,
        trackingNumber: order.label_tracking_number ?? order.tracking_number, daysSinceShipped,
      }
    })
    .filter(o => o.daysSinceShipped >= ADMIN_SHIPPED_REVIEW_DAYS)

  const total = awaitingDispatch.length + awaitingDeliveryConfirmation.length
  if (total > 0) {
    await sendAdminShippingDigestEmail({ to: process.env.ADMIN_EMAIL, awaitingDispatch, awaitingDeliveryConfirmation })
  }

  return Response.json({ sent: total > 0, awaitingDispatch: awaitingDispatch.length, awaitingDeliveryConfirmation: awaitingDeliveryConfirmation.length })
}
