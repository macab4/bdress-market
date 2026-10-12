import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout, sendBoostConfirmedEmail, sendAdminBoostPaidEmail } from '@/lib/email'
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
      .select('listing_id, seller_id, amount')
      .maybeSingle()

    if (updatedBoost) {
      const featuredUntil = new Date(Date.now() + BOOST_DURATION_DAYS * 24 * 60 * 60 * 1000)
      await supabase
        .from('listings')
        .update({ featured_until: featuredUntil.toISOString() })
        .eq('id', updatedBoost.listing_id)

      const [{ data: listing }, { data: seller }] = await Promise.all([
        supabase.from('listings').select('title').eq('id', updatedBoost.listing_id).single(),
        supabase.from('profiles').select('name, email').eq('id', updatedBoost.seller_id).single(),
      ])
      const listingTitle = listing?.title ?? 'tu prenda'

      if (seller?.email) {
        await sendBoostConfirmedEmail({
          to: seller.email, name: seller.name, listingTitle,
          listingId: updatedBoost.listing_id, featuredUntil,
        })
      }
      await sendAdminBoostPaidEmail({
        listingTitle, listingId: updatedBoost.listing_id,
        sellerName: seller?.name ?? null, amount: updatedBoost.amount,
      })
    }

    return Response.json({ status: 'ok' })
  }

  // externalRef es, según el flujo: el id de una orden (compra directa) o un
  // cart_checkout_id compartido por varias órdenes (checkout de carrito) —
  // nunca ambos a la vez, así que matchear por cualquiera de las dos
  // columnas cubre los dos casos con el mismo código, sin necesitar saber
  // de antemano cuál es. Es un UUID generado por nosotras mismas (nunca
  // texto libre de Mercado Pago), así que es seguro interpolarlo en .or().
  const orderId = externalRef

  if (payment.status === 'approved' && orderId) {
    const supabase = createAdminClient()
    const { data: updatedOrders } = await supabase
      .from('orders')
      .update({ status: 'paid', payment_ref: String(payment.id), paid_at: new Date().toISOString() })
      .or(`id.eq.${orderId},cart_checkout_id.eq.${orderId}`)
      .eq('status', 'pending_payment')
      .select('id, listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')

    // Solo si este webhook hizo la transición (evita duplicar el histórico
    // en un reintento del mismo webhook de Mercado Pago).
    if (updatedOrders && updatedOrders.length > 0) {
      await supabase.from('order_status_history').insert(
        updatedOrders.map(o => ({ order_id: o.id, previous_status: 'pending_payment', new_status: 'paid' }))
      )
      // Saca del carrito lo que se acaba de pagar — si vino de /cart, ya
      // cumplió su función ahí.
      await supabase.from('cart_items').delete().eq('user_id', updatedOrders[0].buyer_id).in('listing_id', updatedOrders.map(o => o.listing_id))
    }

    // El saldo pendiente se intenta acreditar SIEMPRE que la(s) orden(es)
    // estén 'paid', sin depender de si este webhook hizo la transición —
    // Mercado Pago reintenta webhooks, y si un intento anterior cambió el
    // status pero se cayó antes de acreditar el saldo, este intento debe
    // poder completarlo. Idempotente por (order_id, type), así que no hay
    // riesgo de duplicar si ya se había acreditado.
    const ordersForWallet = updatedOrders && updatedOrders.length > 0 ? updatedOrders : (
      await supabase
        .from('orders')
        .select('id, listing_id, buyer_id, seller_id, amount, commission, processing_fee, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
        .or(`id.eq.${orderId},cart_checkout_id.eq.${orderId}`)
        .eq('status', 'paid')
    ).data ?? []

    for (const order of ordersForWallet) {
      const pending = await recordSalePending(supabase, {
        id: order.id,
        seller_id: order.seller_id,
        listing_id: order.listing_id,
        amount: order.amount,
        commission: order.commission,
        processing_fee: order.processing_fee,
      })
      if (!pending.ok) await sendWalletAlertEmail({ orderId: order.id, reason: pending.error })

      // Pago mixto (fase 3, y ahora también referidos): si la compradora
      // aplicó saldo y/o Crédito B-Dress al momento de armar la preferencia
      // de Mercado Pago, esos holds se vuelven gasto definitivo recién
      // ahora que el pago se confirmó de verdad — idempotente por
      // (order_id, type), un reintento del webhook no duplica nada.
      if (order.promo_amount_applied > 0) {
        const promoCompleted = await recordPromoPurchaseCompleted(supabase, {
          orderId: order.id, userId: order.buyer_id, amount: order.promo_amount_applied,
          holdTransactionId: order.promo_transaction_id,
        })
        if (!promoCompleted.ok) await sendWalletAlertEmail({ orderId: order.id, reason: promoCompleted.error })
      }
      if (order.wallet_amount_applied > 0) {
        const completed = await recordPurchaseCompleted(supabase, {
          orderId: order.id, userId: order.buyer_id, amount: order.wallet_amount_applied,
          holdTransactionId: order.wallet_transaction_id,
        })
        if (!completed.ok) await sendWalletAlertEmail({ orderId: order.id, reason: completed.error })
      }
    }

    // finalizeOrderPaid (notificación, emails, mensaje de sistema) se
    // intenta SIEMPRE que cada orden esté 'paid' — no solo cuando este
    // webhook hizo la transición — por el mismo motivo que el acreditado de
    // saldo de arriba: si un intento anterior del webhook cambió el status
    // pero se cayó antes de terminar de avisar, este intento tiene que
    // poder completarlo. El update "where finalized_at is null" es el guard
    // atómico, por orden, que evita mandar los avisos dos veces si ya se
    // habían mandado — en un carrito, cada vendedora recibe su propio aviso
    // de venta individual, como siempre.
    for (const order of ordersForWallet) {
      const { data: claimedOrder } = await supabase
        .from('orders')
        .update({ finalized_at: new Date().toISOString() })
        .eq('id', order.id)
        .is('finalized_at', null)
        .select('listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost')
        .maybeSingle()

      if (claimedOrder) {
        await finalizeOrderPaid(supabase, {
          orderId: order.id,
          listingId: claimedOrder.listing_id,
          buyerId: claimedOrder.buyer_id,
          sellerId: claimedOrder.seller_id,
          amount: claimedOrder.amount,
          commission: claimedOrder.commission,
          processingFee: claimedOrder.processing_fee,
          shippingCost: claimedOrder.shipping_cost,
        })
      }
    }
  } else if ((payment.status === 'rejected' || payment.status === 'cancelled') && orderId) {
    const supabase = createAdminClient()
    const { data: orders } = await supabase
      .from('orders')
      .select('id, listing_id, buyer_id, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
      .or(`id.eq.${orderId},cart_checkout_id.eq.${orderId}`)
      .eq('status', 'pending_payment')

    if (orders && orders.length > 0) {
      // Registramos el evento de rechazo aunque orders.status no cambie
      // todavía en este momento (sin hold de saldo aplicado, queda en
      // pending_payment hasta que el cron expire-pending-orders lo cancele)
      // — es el equivalente al "Pendiente → Rechazado" que muestra Mercado
      // Pago, para el panel de carritos abandonados.
      await supabase.from('order_status_history').insert(
        orders.map(o => ({ order_id: o.id, previous_status: 'pending_payment', new_status: 'payment_rejected', public_note: 'Mercado Pago rechazó el pago' }))
      )

      for (const order of orders) {
        // Si la compradora había aplicado saldo B-Dress y/o Crédito B-Dress
        // a esta orden, el rechazo de la tarjeta no debe dejarlos atrapados
        // hasta la próxima corrida del cron (una vez al día) — se liberan
        // de inmediato, igual que cuando falla la creación de la
        // preferencia en payment/create.
        if (order.wallet_amount_applied > 0 || order.promo_amount_applied > 0) {
          await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
        }
        if (order.promo_amount_applied > 0) {
          const promoCancelled = await recordPromoPurchaseCancelled(supabase, {
            orderId: order.id, userId: order.buyer_id, amount: order.promo_amount_applied,
            reason: 'mercadopago_payment_rejected', holdTransactionId: order.promo_transaction_id,
          })
          if (!promoCancelled.ok) await sendWalletAlertEmail({ orderId: order.id, reason: promoCancelled.error })
        }
        if (order.wallet_amount_applied > 0) {
          const cancelled = await recordPurchaseCancelled(supabase, {
            orderId: order.id, userId: order.buyer_id, amount: order.wallet_amount_applied,
            reason: 'mercadopago_payment_rejected', holdTransactionId: order.wallet_transaction_id,
          })
          if (!cancelled.ok) await sendWalletAlertEmail({ orderId: order.id, reason: cancelled.error })
        }
      }

      // Un solo email a la compradora, listando todas las prendas del
      // intento de pago — evita mandarle N correos de "pago rechazado"
      // separados cuando el rechazo fue de un carrito de varias vendedoras.
      const [{ data: listings }, { data: buyer }] = await Promise.all([
        supabase.from('listings').select('id, title').in('id', orders.map(o => o.listing_id)),
        supabase.from('profiles').select('email, name').eq('id', orders[0].buyer_id).single(),
      ])
      const titles = (listings ?? []).map(l => l.title)
      const retryUrl = orders.length === 1 ? `${SITE_URL}/listings/${orders[0].listing_id}/checkout` : `${SITE_URL}/cart`

      if (buyer?.email) {
        await sendEmail({
          to: buyer.email,
          subject: `No pudimos procesar tu pago — ${titles[0] ?? 'tu compra'}${titles.length > 1 ? ` y ${titles.length - 1} más` : ''}`,
          html: emailLayout('Pago rechazado', `
            <p style="font-size: 14px; color: #444; line-height: 1.6;">
              Hola ${buyer.name ?? ''}, Mercado Pago rechazó el pago de <strong>${titles.join(', ') || 'tu compra'}</strong>.
              No te cobramos nada. ${titles.length > 1 ? 'Las prendas siguen' : 'La prenda sigue'} disponible — puedes intentarlo de nuevo con otro medio de pago.
            </p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="${retryUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
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
