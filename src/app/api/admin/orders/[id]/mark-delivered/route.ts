import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-auth'
import { sendDeliveryConfirmedEmail } from '@/lib/email'

// Respaldo para la admin cuando el courier ya confirma la entrega (ver su
// página pública de seguimiento) pero la compradora nunca vuelve a entrar a
// la app a confirmar recepción (api/orders/[id]/confirm) — sin eso, el
// plazo de CONFIRMED_HOLD_DAYS para liberar el pago a la vendedora nunca
// arranca y la venta queda "shipped" indefinidamente (hasta el respaldo
// automático de SHIPPED_FALLBACK_DAYS, ver cron/auto-release). `delivered_at`
// se puede fijar a la fecha real de entrega que informa el courier —
// nunca se fuerza a "ahora" si la entrega ya ocurrió antes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdminEmail(user?.email)) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const deliveredAtRaw = typeof body?.delivered_at === 'string' ? body.delivered_at : null

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_id, seller_id, listing_id, international_status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.international_status !== null) {
    return Response.json({ error: 'Esta es una orden internacional — usa las acciones de Selección internacional' }, { status: 400 })
  }
  if (order.status !== 'shipped') return Response.json({ error: 'La orden todavía no está despachada' }, { status: 409 })

  const deliveredAt = deliveredAtRaw ? new Date(deliveredAtRaw) : new Date()
  if (Number.isNaN(deliveredAt.getTime())) return Response.json({ error: 'Fecha inválida' }, { status: 400 })

  const { error } = await admin
    .from('orders')
    .update({ status: 'delivered', confirmed_at: deliveredAt.toISOString() })
    .eq('id', id)
    .eq('status', 'shipped')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
  ])
  const listingTitle = listing?.title ?? 'esta prenda'

  await Promise.all([
    buyer?.email
      ? sendDeliveryConfirmedEmail({ to: buyer.email, name: buyer.name, listingTitle, role: 'buyer', confirmedByAdmin: true })
      : Promise.resolve(),
    seller?.email
      ? sendDeliveryConfirmedEmail({ to: seller.email, name: seller.name, listingTitle, role: 'seller', confirmedByAdmin: true })
      : Promise.resolve(),
  ])

  return Response.json({ ok: true })
}
