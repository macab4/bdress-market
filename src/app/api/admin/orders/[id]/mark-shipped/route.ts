import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-auth'
import { sendOrderShippedEmail } from '@/lib/email'

// Respaldo para la admin cuando el despacho ya ocurrió en la realidad (la
// admin generó la etiqueta y el courier ya la recibió, ver
// admin/orders/[id]/label) pero la vendedora nunca vuelve a entrar a la app
// a ingresar el número de seguimiento (api/orders/[id]/ship) — sin eso,
// orders.status queda atascado en 'paid' para siempre, aunque el paquete ya
// esté en camino o incluso entregado. Solo para el carril nacional — las
// órdenes internacionales usan su propia máquina de estados
// (international_status) vía admin/international/orders/[id]/actions.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const trackingNumberOverride = typeof body?.tracking_number === 'string' ? body.tracking_number.trim() : ''
  const shippedAtRaw = typeof body?.shipped_at === 'string' ? body.shipped_at : null

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_id, listing_id, label_tracking_number, tracking_number, international_status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.international_status !== null) {
    return Response.json({ error: 'Esta es una orden internacional — usa las acciones de Selección internacional' }, { status: 400 })
  }
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está en estado pagado' }, { status: 409 })

  const trackingNumber = trackingNumberOverride || order.label_tracking_number || order.tracking_number
  if (!trackingNumber) return Response.json({ error: 'Falta el número de seguimiento' }, { status: 400 })

  const shippedAt = shippedAtRaw ? new Date(shippedAtRaw) : new Date()
  if (Number.isNaN(shippedAt.getTime())) return Response.json({ error: 'Fecha inválida' }, { status: 400 })

  const { error } = await admin
    .from('orders')
    .update({ status: 'shipped', shipped_at: shippedAt.toISOString(), tracking_number: trackingNumber })
    .eq('id', id)
    .eq('status', 'paid')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: buyer }, { data: listing }] = await Promise.all([
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  if (buyer?.email) {
    await sendOrderShippedEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? '', trackingNumber })
  }

  return Response.json({ ok: true })
}
