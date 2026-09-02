import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeOrderRefund, sendSystemMessage } from '@/lib/orderNotifications'

// Cancelación por la vendedora antes de despachar (ej. publicó mal la prenda,
// precio equivocado, era una prueba). Solo procede en estado 'paid' — una vez
// despachada, la compradora ya tiene (o está por tener) la prenda en tránsito
// y eso debe resolverse por disputa/admin, no con auto-cancelación.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let reason: string | null = null
  try {
    const body = await request.json()
    if (typeof body?.reason === 'string' && body.reason.trim()) reason = body.reason.trim()
  } catch {
    // reason es opcional — un body vacío es válido
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, status, payment_ref, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id, amount, commission, processing_fee')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') {
    return Response.json({ error: 'Esta venta ya no se puede cancelar (ya fue despachada o ya está resuelta)' }, { status: 409 })
  }

  const result = await executeOrderRefund(admin, {
    orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    paymentRef: order.payment_ref, walletAmountApplied: order.wallet_amount_applied, walletTransactionId: order.wallet_transaction_id,
    promoAmountApplied: order.promo_amount_applied, promoTransactionId: order.promo_transaction_id,
  }, {
    createdBy: user.id,
    reversalDescription: 'Reverso por cancelación de la vendedora',
    walletRefundReason: 'seller_cancelled',
  })

  if (!result.ok) return Response.json({ error: result.error }, { status: 502 })

  await sendSystemMessage(admin, {
    listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    content: `La vendedora canceló esta venta y tu pago fue reembolsado.${reason ? ` Motivo: ${reason}` : ''}`,
  })

  return Response.json({ ok: true })
}
