import { createClient } from '@/lib/supabase/server'

const DISPUTABLE_STATUSES = ['paid', 'shipped', 'delivered']

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
    .select('id, buyer_id, seller_id, status')
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
  return Response.json({ ok: true })
}
