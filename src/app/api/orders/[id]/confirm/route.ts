import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailLayout } from '@/lib/email'
import { CONFIRMED_HOLD_DAYS } from '@/lib/catalog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.buyer_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'shipped') return Response.json({ error: 'La orden no está en estado "enviado"' }, { status: 409 })

  const { error } = await supabase
    .from('orders')
    .update({ status: 'delivered', confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'shipped')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    supabase.from('listings').select('title').eq('id', order.listing_id).single(),
    supabase.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    supabase.from('profiles').select('email, name').eq('id', order.seller_id).single(),
  ])

  const listingTitle = listing?.title ?? 'tu compra'

  if (buyer?.email) {
    await sendEmail({
      to: buyer.email,
      subject: `Confirmaste la recepción — ${listingTitle}`,
      html: emailLayout('Recepción confirmada', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${buyer.name ?? ''}, confirmamos que recibiste <strong>${listingTitle}</strong>.
          Todavía tienes ${CONFIRMED_HOLD_DAYS} días para reportar un problema si algo no está bien.
          Pasado ese plazo, liberamos el pago a la vendedora.
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver mi compra
          </a>
        </p>
      `),
    })
  }

  if (seller?.email) {
    await sendEmail({
      to: seller.email,
      subject: `La compradora confirmó la recepción — ${listingTitle}`,
      html: emailLayout('Recepción confirmada', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${seller.name ?? ''}, la compradora confirmó que recibió <strong>${listingTitle}</strong>.
          Si no reporta un problema, en ${CONFIRMED_HOLD_DAYS} días liberamos tu pago.
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/sales" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ir a Mis ventas
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true })
}
