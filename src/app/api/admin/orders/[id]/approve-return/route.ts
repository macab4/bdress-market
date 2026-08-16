import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReturnApprovedEmail } from '@/lib/email'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL ? user : null
}

// Primer paso del reembolso con devolución: la compradora ya tiene la
// prenda en mano y hay que recuperarla antes de devolverle la plata (a
// diferencia de resolve/route.ts, acción 'refund', que sigue siendo
// instantánea para los casos sin nada físico que devolver — ej. la
// vendedora nunca despachó). No mueve nada de saldo todavía — el reembolso
// real recién ocurre en mark-return-received, cuando la admin confirma que
// la prenda volvió a manos de la vendedora.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await checkAdmin()
  if (!adminUser) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, status')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.status !== 'disputed') return Response.json({ error: 'Esta orden no está en disputa' }, { status: 409 })

  const { error } = await admin
    .from('orders')
    .update({ status: 'return_pending', return_approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'disputed')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const [{ data: buyer }, { data: listing }] = await Promise.all([
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  if (buyer?.email) {
    await sendReturnApprovedEmail({ to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? 'tu compra' })
  }

  return Response.json({ ok: true })
}
