import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeOrderRefund } from '@/lib/orderNotifications'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL ? user : null
}

// Paso final del reembolso con devolución: la admin confirmó (vía
// seguimiento del courier) que la vendedora recibió la prenda de vuelta —
// recién acá se ejecuta el reembolso real, con la misma lógica que usa el
// reembolso instantáneo (ver executeOrderRefund en lib/orderNotifications.ts).
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
    .select('id, listing_id, buyer_id, seller_id, status, payment_ref, wallet_amount_applied, wallet_transaction_id')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.status !== 'return_pending') {
    return Response.json({ error: 'Esta orden no tiene una devolución en curso' }, { status: 409 })
  }

  const result = await executeOrderRefund(admin, {
    orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    paymentRef: order.payment_ref, walletAmountApplied: order.wallet_amount_applied, walletTransactionId: order.wallet_transaction_id,
  }, {
    createdBy: adminUser.id,
    reversalDescription: 'Reverso por devolución — la vendedora recibió la prenda de vuelta',
    walletRefundReason: 'admin_refund_after_return',
    returnReceivedAt: new Date().toISOString(),
  })

  if (!result.ok) return Response.json({ error: result.error }, { status: 502 })
  return Response.json({ ok: true })
}
