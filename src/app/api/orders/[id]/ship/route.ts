import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderShippedEmail, sendInternationalNationallyShippedEmail } from '@/lib/email'
import { isAdminEmail } from '@/lib/admin-auth'
import { sendSystemMessage } from '@/lib/orderNotifications'

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
    .select('id, seller_id, buyer_id, listing_id, status, international_status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })

  // Productos internacionales: la "vendedora" es el perfil de sistema
  // Bdress Internacional, sin login propio — quien despacha es la admin.
  const isInternational = order.international_status !== null
  const canManage = order.seller_id === user.id || (isInternational && isAdminEmail(user.email))
  if (!canManage) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está pagada' }, { status: 409 })

  // No se puede registrar el despacho nacional hasta que la prenda esté
  // físicamente en Chile (ver sección 13 del encargo).
  if (isInternational && order.international_status !== 'received_in_chile' && order.international_status !== 'national_shipping_pending') {
    return Response.json({ error: 'La prenda todavía no llega a Chile — no se puede registrar el despacho nacional todavía' }, { status: 409 })
  }

  const { error } = await supabase
    .from('orders')
    .update({
      tracking_number,
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      ...(isInternational ? { international_status: 'nationally_shipped' } : {}),
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (isInternational) {
    await supabase.from('order_status_history').insert({
      order_id: id,
      previous_status: order.international_status,
      new_status: 'nationally_shipped',
      changed_by: user.id,
      public_note: 'Tu prenda ya fue despachada dentro de Chile.',
    })
  }

  const [{ data: buyer }, { data: listing }] = await Promise.all([
    supabase.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    supabase.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  if (buyer?.email) {
    if (isInternational) {
      await sendInternationalNationallyShippedEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? '', trackingNumber: tracking_number })
    } else {
      await sendOrderShippedEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? '', trackingNumber: tracking_number })
    }
  }

  await sendSystemMessage(createAdminClient(), {
    listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    content: `Tu prenda fue despachada 📦 Número de seguimiento: ${tracking_number}`,
  })

  return Response.json({ ok: true })
}
