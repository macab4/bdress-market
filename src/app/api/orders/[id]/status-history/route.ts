import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Historial de estados del carril internacional, visto por la clienta.
// Filtra columnas server-side (nunca internal_note ni changed_by) en vez de
// depender de que el frontend recuerde no pedirlas — la tabla
// order_status_history no tiene policy de select para usuarias.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_id')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.buyer_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = createAdminClient()
  const { data: history, error } = await admin
    .from('order_status_history')
    .select('new_status, public_note, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ history: history ?? [] })
}
