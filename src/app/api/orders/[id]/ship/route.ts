import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailLayout } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let tracking_number: string
  try {
    const body = await request.json()
    tracking_number = body.tracking_number?.trim()
    if (!tracking_number) throw new Error()
  } catch {
    return Response.json({ error: 'tracking_number requerido' }, { status: 400 })
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, seller_id, buyer_id, listing_id, status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está pagada' }, { status: 409 })

  const { error } = await supabase
    .from('orders')
    .update({ tracking_number, status: 'shipped', shipped_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: buyer }, { data: listing }] = await Promise.all([
    supabase.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    supabase.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  if (buyer?.email) {
    await sendEmail({
      to: buyer.email,
      subject: `Tu prenda va en camino — ${listing?.title ?? ''}`,
      html: emailLayout('Prenda despachada', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${buyer.name ?? ''}, tu compra <strong>${listing?.title ?? ''}</strong> ya fue despachada.
        </p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Número de seguimiento: <strong style="font-family: monospace;">${tracking_number}</strong>
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver mi compra
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true })
}
