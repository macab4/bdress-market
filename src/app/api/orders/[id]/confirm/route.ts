import { createClient } from '@/lib/supabase/server'
import { sendDeliveryConfirmedEmail } from '@/lib/email'

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
    .select('id, listing_id, buyer_id, seller_id, status, international_status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.buyer_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'shipped') return Response.json({ error: 'La orden no está en estado "enviado"' }, { status: 409 })

  const isInternational = order.international_status !== null
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      confirmed_at: new Date().toISOString(),
      ...(isInternational ? { international_status: 'delivered' } : {}),
    })
    .eq('id', id)
    .eq('status', 'shipped')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (isInternational) {
    await supabase.from('order_status_history').insert({
      order_id: id,
      previous_status: order.international_status,
      new_status: 'delivered',
      changed_by: user.id,
      public_note: 'Confirmaste la recepción de tu prenda.',
    })
  }

  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    supabase.from('listings').select('title').eq('id', order.listing_id).single(),
    supabase.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    supabase.from('profiles').select('email, name').eq('id', order.seller_id).single(),
  ])

  const listingTitle = listing?.title ?? 'tu compra'

  if (buyer?.email) {
    await sendDeliveryConfirmedEmail({ to: buyer.email, name: buyer.name, listingTitle, role: 'buyer' })
  }

  if (seller?.email) {
    await sendDeliveryConfirmedEmail({ to: seller.email, name: seller.name, listingTitle, role: 'seller' })
  }

  return Response.json({ ok: true })
}
