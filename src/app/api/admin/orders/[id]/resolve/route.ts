import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReviewReminderEmail } from '@/lib/email'
import { recordSaleRelease, recordSaleReversal, recordPurchaseRefund, sendWalletAlertEmail } from '@/lib/wallet'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!

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
    .select('id, listing_id, buyer_id, seller_id, status, payment_ref, wallet_amount_applied, wallet_transaction_id')
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
    ])

    return Response.json({ ok: true })
  }

  // action === 'refund'. Con pago mixto (fase 3) una orden puede no tener
  // payment_ref (se pagó 100% con saldo) — solo rechazar si NO hay nada que
  // reembolsar por ningún canal.
  if (!order.payment_ref && order.wallet_amount_applied === 0) {
    return Response.json({ error: 'Esta orden no tiene ningún pago asociado para reembolsar' }, { status: 409 })
  }

  // La preferencia de Mercado Pago (si existió) ya se armó solo por lo que
  // faltaba después de aplicar el saldo (ver payment/create), así que
  // reembolsar el 100% de ese payment_ref ya reembolsa exactamente la parte
  // que correspondía a Mercado Pago — sin ningún cálculo extra.
  if (order.payment_ref) {
    const refundRes = await fetch(`https://api.mercadopago.com/v1/payments/${order.payment_ref}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
    })

    if (!refundRes.ok) {
      const errBody = await refundRes.json().catch(() => ({}))
      return Response.json({ error: errBody.message || 'Error al reembolsar en Mercado Pago' }, { status: 502 })
    }
  }

  await admin.from('orders').update({ status: 'cancelled' }).eq('id', id)
  await admin.from('listings').update({ status: 'active' }).eq('id', order.listing_id)

  const reversal = await recordSaleReversal(admin, id, {
    description: 'Reverso por reembolso de la compradora',
    createdBy: adminUser.id,
  })
  if (!reversal.ok) await sendWalletAlertEmail({ orderId: id, reason: reversal.error })

  // Devuelve a disponible la parte de saldo que la compradora había
  // aplicado. Para llegar a 'refund' la orden pasó por 'paid' (disputed
  // también viene de ahí), así que el hold ya se convirtió en gasto
  // definitivo (recordPurchaseCompleted, en confirm o en el camino
  // 100%-saldo) — acá solo se le devuelve el monto a disponible.
  if (order.wallet_amount_applied > 0) {
    const purchaseRefund = await recordPurchaseRefund(admin, {
      orderId: id, userId: order.buyer_id, amount: order.wallet_amount_applied,
      reason: 'admin_refund', holdTransactionId: order.wallet_transaction_id, createdBy: adminUser.id,
    })
    if (!purchaseRefund.ok) await sendWalletAlertEmail({ orderId: id, reason: purchaseRefund.error })
  }

  return Response.json({ ok: true })
}
