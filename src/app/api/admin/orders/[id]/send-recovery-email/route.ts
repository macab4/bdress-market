import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAbandonedCartRecoveryEmail } from '@/lib/email'

async function checkAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Reenvío manual desde /admin/orders/abandoned — a diferencia del cron
// abandoned-cart-recovery, esta acción es explícita del admin y se puede
// disparar aunque ya se haya mandado un recordatorio automático antes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuthorized(request))) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('listing_id, buyer_id, amount, paid_at')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.paid_at) return Response.json({ error: 'Esta orden ya está pagada' }, { status: 409 })

  const [{ data: listing }, { data: buyer }] = await Promise.all([
    admin.from('listings').select('title, status').eq('id', order.listing_id).single(),
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
  ])

  if (listing?.status !== 'active') {
    return Response.json({ error: 'La prenda ya no está disponible' }, { status: 409 })
  }
  if (!buyer?.email) {
    return Response.json({ error: 'La compradora no tiene email' }, { status: 409 })
  }

  await sendAbandonedCartRecoveryEmail({
    to: buyer.email,
    name: buyer.name,
    listingTitle: listing.title,
    listingId: order.listing_id,
    amount: order.amount,
  })
  await admin.from('orders').update({ abandoned_recovery_sent_at: new Date().toISOString() }).eq('id', id)

  return Response.json({ ok: true })
}
