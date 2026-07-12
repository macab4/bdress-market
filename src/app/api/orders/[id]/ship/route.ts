import { createClient } from '@/lib/supabase/server'

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
    .select('id, seller_id, status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está pagada' }, { status: 409 })

  const { error } = await supabase
    .from('orders')
    .update({ tracking_number, status: 'shipped' })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
