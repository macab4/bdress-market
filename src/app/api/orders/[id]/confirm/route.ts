import { createClient } from '@/lib/supabase/server'

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
    .select('id, buyer_id, status')
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

  return Response.json({ ok: true })
}
