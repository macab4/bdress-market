import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReviewReminderEmail, sendWalletBalanceChangedEmail } from '@/lib/email'
import { recordSaleRelease, orderNetAmount, sendWalletAlertEmail } from '@/lib/wallet'
import { executeOrderRefund } from '@/lib/orderNotifications'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL ? user : null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await checkAdmin()
  if (!adminUser) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  let action: string
  try {
    const body = await request.json()
    action = body.action
    if (!['refund', 'release'].includes(action)) throw new Error()
  } catch {
    return Response.json({ error: 'action inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, seller_id, status, payment_ref, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id, amount, commission, processing_fee')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })

  // "release" solo tiene sentido resolviendo una disputa.
  // "refund" también se usa para cancelar envíos atrasados que nunca se disputaron.
  if (action === 'release' && order.status !== 'disputed') {
    return Response.json({ error: 'Esta orden no está en disputa' }, { status: 409 })
  }
  if (action === 'refund' && !['disputed', 'paid'].includes(order.status)) {
    return Response.json({ error: 'Esta orden no se puede reembolsar en su estado actual' }, { status: 409 })
  }

  if (action === 'release') {
    const { error } = await admin
      .from('orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const release = await recordSaleRelease(admin, id, {
      source: 'admin_dispute_release',
      description: 'Venta liberada — disputa resuelta a favor de la vendedora',
      createdBy: adminUser.id,
    })
    if (!release.ok) await sendWalletAlertEmail({ orderId: id, reason: release.error })

    const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
      admin.from('listings').select('title').eq('id', order.listing_id).single(),
      admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
      admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
    ])
    const listingTitle = listing?.title ?? 'esta prenda'
    await Promise.all([
      buyer?.email
        ? sendReviewReminderEmail({ to: buyer.email, name: buyer.name, listingTitle, role: 'buyer' })
        : Promise.resolve(),
      seller?.email
        ? sendReviewReminderEmail({ to: seller.email, name: seller.name, listingTitle, role: 'seller' })
        : Promise.resolve(),
      seller?.email && release.ok
        ? sendWalletBalanceChangedEmail({
            to: seller.email, name: seller.name, amount: orderNetAmount(order),
            reason: `Venta liberada — ${listingTitle}`,
          })
        : Promise.resolve(),
    ])

    return Response.json({ ok: true })
  }

  // action === 'refund' — instantáneo, para cuando no hay nada físico que
  // devolver (ej. la vendedora nunca despachó). Si la compradora ya tiene
  // la prenda en mano, usar 'Aprobar devolución' en vez de esto (ver
  // api/admin/orders/[id]/approve-return) — ese reembolso queda retenido
  // hasta que la prenda vuelva a manos de la vendedora.
  //
  // Con pago mixto (fase 3, y ahora también Crédito B-Dress) una orden
  // puede no tener payment_ref (se pagó 100% con saldo/crédito) — solo
  // rechazar si NO hay nada que reembolsar por ningún canal.
  if (!order.payment_ref && order.wallet_amount_applied === 0 && order.promo_amount_applied === 0) {
    return Response.json({ error: 'Esta orden no tiene ningún pago asociado para reembolsar' }, { status: 409 })
  }

  const result = await executeOrderRefund(admin, {
    orderId: order.id, listingId: order.listing_id, buyerId: order.buyer_id, sellerId: order.seller_id,
    paymentRef: order.payment_ref, walletAmountApplied: order.wallet_amount_applied, walletTransactionId: order.wallet_transaction_id,
    promoAmountApplied: order.promo_amount_applied, promoTransactionId: order.promo_transaction_id,
  }, {
    createdBy: adminUser.id,
    reversalDescription: 'Reverso por reembolso de la compradora',
    walletRefundReason: 'admin_refund',
  })

  if (!result.ok) return Response.json({ error: result.error }, { status: 502 })
  return Response.json({ ok: true })
}
