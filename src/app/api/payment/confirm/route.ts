import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import { BOOST_DURATION_DAYS } from '@/lib/catalog'
import {
  recordSalePending, recordPurchaseCompleted, recordPurchaseCancelled,
  recordPromoPurchaseCompleted, recordPromoPurchaseCancelled, sendWalletAlertEmail,
} from '@/lib/wallet'
import { finalizeOrderPaid } from '@/lib/orderNotifications'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

async function handleNotification(request: Request) {
  let paymentId: string | null = null

  // Mercado Pago Webhooks (v2): POST con body { type: 'payment', data: { id } }
  try {
    const body = await request.json()
    if (body?.type === 'payment' && body?.data?.id) {
      paymentId = String(body.data.id)
    }
  } catch {
    // sin body JSON — puede venir como IPN clásico por query params
  }

  if (!paymentId) {
    const { searchParams } = new URL(request.url)
    if (searchParams.get('type') === 'payment' || searchParams.get('topic') === 'payment') {
      paymentId = searchParams.get('data.id') ?? searchParams.get('id')
    }
  }

  if (!paymentId) {
    return Response.json({ status: 'ignored' })
  }

  // Consultar el pago real a Mercado Pago (nunca confiar en el body del webhook a ciegas)
  const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  })
  if (!paymentRes.ok) {
    return Response.json({ error: 'Error consultando Mercado Pago' }, { status: 502 })
  }

  const payment = await paymentRes.json()
  const externalRef: string | undefined = payment.external_reference

  if (payment.status === 'approved' && externalRef?.startsWith('boost:')) {
    const boostId = externalRef.slice('boost:'.length)
    const supabase = createAdminClient()
    const { data: updatedBoost } = await supabase
      .from('listing_boosts')
      .update({ status: 'paid', payment_ref: String(payment.id), paid_at: new Date().toISOString() })
      .eq('id', boostId)
      .eq('status', 'pending_payment')
      .select('listing_id')
      .maybeSingle()

    if (updatedBoost) {
      const featuredUntil = new Date(Date.now() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000)
      await supabase
        .from('listings')
        .update({ featured_until: featuredUntil.toISOString() })
        .eq('id', updatedBoost.listing_id)
    }

    return Response.json({ status: 'ok' })
  }

  const orderId = externalRef

  if (payment.status === 'approved' && orderId) {
    const supabase = createAdminClient()
    const { data: updatedOrder } = await supabase
      .from('orders')
      .update({ status: 'paid', payment_ref: String(payment.id), paid_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .select('listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
      .maybeSingle()

    // Solo si este webhook hizo la transición (evita duplicar el histórico
    // en un reintento del mismo webhook de Mercado Pago).
    if (updatedOrder) {
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        previous_status: 'pending_payment',
        new_status: 'paid',
      })
    }

    // El saldo pendiente se intenta acreditar SIEMPRE que la orden esté
    // 'paid', sin depender de si este webhook hizo la transición — Mercado
    // Pago reintenta webhooks, y si un intento anterior cambió el status
    // pero se cayó antes de acreditar el saldo, este intento debe poder
    // completarlo. Idempotente por (order_id, type), así que no hay riesgo
    // de duplicar si ya se había acreditado.
    const orderForWallet = updatedOrder ?? (
      await supabase
        .from('orders')
        .select('listing_id, buyer_id, seller_id, amount, commission, processing_fee, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
        .eq('id', orderId)
        .eq('status', 'paid')
        .maybeSingle()
    ).data
    if (orderForWallet) {
      const pending = await recordSalePending(supabase, {
        id: orderId,
        seller_id: orderForWallet.seller_id,
        listing_id: orderForWallet.listing_id,
        amount: orderForWallet.amount,
        commission: orderForWallet.commission,
        processing_fee: orderForWallet.processing_fee,
      })
      if (!pending.ok) await sendWalletAlertEmail({ orderId, reason: pending.error })

      // Pago mixto (fase 3, y ahora también referidos): si la compradora
      // aplicó saldo y/o Crédito B-Dress al momento de armar la preferencia
      // de Mercado Pago, esos holds se vuelven gasto definitivo recién
      // ahora que el pago se confirmó de verdad — idempotente por
      // (order_id, type), un reintento del webhook no duplica nada.
      if (orderForWallet.promo_amount_applied > 0) {
        const promoCompleted = await recordPromoPurchaseCompleted(supabase, {
          orderId, userId: orderForWallet.buyer_id, amount: orderForWallet.promo_amount_applied,
          holdTransactionId: orderForWallet.promo_transaction_id,
        })
        if (!promoCompleted.ok) await sendWalletAlertEmail({ orderId, reason: promoCompleted.error })
      }
      if (orderForWallet.wallet_amount_applied > 0) {
        const completed = await recordPurchaseCompleted(supabase, {
          orderId, userId: orderForWallet.buyer_id, amount: orderForWallet.wallet_amount_applied,
          holdTransactionId: orderForWallet.wallet_transaction_id,
        })
        if (!completed.ok) await sendWalletAlertEmail({ orderId, reason: completed.error })
      }
    }

    // Solo marcamos la prenda vendida la primera vez que la orden pasa a pagada
    // (evita reprocesar si Mercado Pago reenvía el mismo webhook).
    if (updatedOrder) {
      await finalizeOrderPaid(supabase, {
        orderId,
        listingId: updatedOrder.listing_id,
        buyerId: updatedOrder.buyer_id,
        sellerId: updatedOrder.seller_id,
        amount: updatedOrder.amount,
        commission: updatedOrder.commission,
        processingFee: updatedOrder.processing_fee,
        shippingCost: updatedOrder.shipping_cost,
      })
    }
  } else if ((payment.status === 'rejected' || payment.status === 'cancelled') && orderId) {
    const supabase = createAdminClient()
    const { data: order } = await supabase
      .from('orders')
      .select('listing_id, buyer_id, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .maybeSingle()

    if (order) {
      // Registramos el evento de rechazo aunque orders.status no cambie
      // todavía en este momento (sin hold de saldo aplicado, queda en
      // pending_payment hasta que el cron expire-pending-orders lo cancele)
      // — es el equivalente al "Pendiente → Rechazado" que muestra Mercado
      // Pago, para el panel de carritos abandonados.
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        previous_status: 'pending_payment',
        new_status: 'payment_rejected',
        public_note: 'Mercado Pago rechazó el pago',
      })

      // Si la compradora había aplicado saldo B-Dress y/o Crédito B-Dress a
      // esta orden, el rechazo de la tarjeta no debe dejarlos atrapados
      // hasta la próxima corrida del cron (una vez al día) — se liberan de
      // inmediato, igual que cuando falla la creación de la preferencia en
      // payment/create.
      if (order.wallet_amount_applied > 0 || order.promo_amount_applied > 0) {
        await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      }
      if (order.promo_amount_applied > 0) {
        const promoCancelled = await recordPromoPurchaseCancelled(supabase, {
          orderId, userId: order.buyer_id, amount: order.promo_amount_applied,
          reason: 'mercadopago_payment_rejected', holdTransactionId: order.promo_transaction_id,
        })
        if (!promoCancelled.ok) await sendWalletAlertEmail({ orderId, reason: promoCancelled.error })
      }
      if (order.wallet_amount_applied > 0) {
        const cancelled = await recordPurchaseCancelled(supabase, {
          orderId, userId: order.buyer_id, amount: order.wallet_amount_applied,
          reason: 'mercadopago_payment_rejected', holdTransactionId: order.wallet_transaction_id,
        })
        if (!cancelled.ok) await sendWalletAlertEmail({ orderId, reason: cancelled.error })
      }

      const [{ data: listing }, { data: buyer }] = await Promise.all([
        supabase.from('listings').select('title').eq('id', order.listing_id).single(),
        supabase.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
      ])

      if (buyer?.email) {
        await sendEmail({
          to: buyer.email,
          subject: `No pudimos procesar tu pago — ${listing?.title ?? 'tu compra'}`,
          html: emailLayout('Pago rechazado', `
            <p style="font-size: 14px; color: #444; line-height: 1.6;">
              Hola ${buyer.name ?? ''}, Mercado Pago rechazó el pago de <strong>${listing?.title ?? 'esta prenda'}</strong>.
              No te cobramos nada. La prenda sigue disponible — puedes intentarlo de nuevo con otro medio de pago.
            </p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="${SITE_URL}/listings/${order.listing_id}/checkout" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                Intentar de nuevo
              </a>
            </p>
          `),
        })
      }
    }
  }

  return Response.json({ status: 'ok' })
}

export async function POST(request: Request) {
  return handleNotification(request)
}

export async function GET(request: Request) {
  return handleNotification(request)
}
