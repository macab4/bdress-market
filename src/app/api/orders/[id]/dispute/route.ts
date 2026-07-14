import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailLayout } from '@/lib/email'

const DISPUTABLE_STATUSES = ['paid', 'shipped', 'delivered']
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let reason: string
  try {
    const body = await request.json()
    reason = body.reason
    if (!reason || typeof reason !== 'string') throw new Error()
  } catch {
    return Response.json({ error: 'reason requerido' }, { status: 400 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }
  if (!DISPUTABLE_STATUSES.includes(order.status)) {
    return Response.json({ error: 'Esta orden no se puede reportar en su estado actual' }, { status: 409 })
  }

  const { error } = await supabase
    .from('orders')
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Antes esto dependía de que alguien entrara a revisar /admin/disputas
  // manualmente — ahora avisamos a la contraparte y al equipo apenas se abre.
  const openedByBuyer = user.id === order.buyer_id
  const counterpartyId = openedByBuyer ? order.seller_id : order.buyer_id

  const [{ data: listing }, { data: counterparty }] = await Promise.all([
    supabase.from('listings').select('title').eq('id', order.listing_id).single(),
    supabase.from('profiles').select('email, name').eq('id', counterpartyId).single(),
  ])

  const listingTitle = listing?.title ?? 'tu orden'
  const dashboardPath = openedByBuyer ? '/dashboard/sales' : '/dashboard/purchases'

  if (counterparty?.email) {
    await sendEmail({
      to: counterparty.email,
      subject: `Se abrió una disputa — ${listingTitle}`,
      html: emailLayout('Disputa abierta', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${counterparty.name ?? ''}, ${openedByBuyer ? 'la compradora' : 'la vendedora'} reportó un problema con
          <strong>${listingTitle}</strong>. El pago queda retenido mientras nuestro equipo revisa el caso.
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}${dashboardPath}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver el detalle
          </a>
        </p>
      `),
    })
  }

  if (process.env.ADMIN_EMAIL) {
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `Nueva disputa — ${listingTitle}`,
      html: emailLayout('Nueva disputa', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Se abrió una disputa en la orden <strong>${id}</strong> (${listingTitle}), reportada por
          ${openedByBuyer ? 'la compradora' : 'la vendedora'}. Motivo: "${reason}".
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/admin/disputes" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ir al panel de disputas
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true })
}
