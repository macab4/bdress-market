import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReviewReminderEmail } from '@/lib/email'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  let action: string
  try {
    const body = await request.json()
    action = body.action
    if (!['refund', 'release'].includes(action)) throw new Error()
  } catch {
    return Response.json({ error: 'action inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, status, payment_ref')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })

  // "release" solo tiene sentido resolviendo una disputa.
  // "refund" también se usa para cancelar envíos atrasados que nunca se disputaron.
  if (action === 'release' && order.status !== 'disputed') {
    return Response.json({ error: 'Esta orden no está en disputa' }, { status: 409 })
  }
  if (action === 'refund' && !['disputed', 'paid'].includes(order.status)) {
    return Response.json({ error: 'Esta orden no se puede reembolsar en su estado actual' }, { status: 409 })
  }

  if (action === 'release') {
    const { error } = await admin.from('orders').update({ status: 'completed' }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const [{ data: listing }, { data: buyer }] = await Promise.all([
      admin.from('listings').select('title').eq('id', order.listing_id).single(),
      admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    ])
    if (buyer?.email) {
      await sendReviewReminderEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? 'tu compra' })
    }

    return Response.json({ ok: true })
  }

  // action === 'refund'
  if (!order.payment_ref) {
    return Response.json({ error: 'Esta orden no tiene un pago de Mercado Pago asociado para reembolsar' }, { status: 409 })
  }

  const refundRes = await fetch(`https://api.mercadopago.com/v1/payments/${order.payment_ref}/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      'X-Idempotency-Key': crypto.randomUUID(),
    },
  })

  if (!refundRes.ok) {
    const errBody = await refundRes.json().catch(() => ({}))
    return Response.json({ error: errBody.message || 'Error al reembolsar en Mercado Pago' }, { status: 502 })
  }

  await admin.from('orders').update({ status: 'cancelled' }).eq('id', id)
  await admin.from('listings').update({ status: 'active' }).eq('id', order.listing_id)

  return Response.json({ ok: true })
}
