import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout, sendInternationalOrderReceivedEmail, sendInternationalAdminActionNeededEmail } from '@/lib/email'
import { PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED, BOOST_DURATION_DAYS } from '@/lib/catalog'
import { recordSalePending, sendWalletAlertEmail } from '@/lib/wallet'

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
      .select('listing_id, buyer_id, seller_id, amount, commission, processing_fee, shipping_cost')
      .maybeSingle()

    // El saldo pendiente se intenta acreditar SIEMPRE que la orden esté
    // 'paid', sin depender de si este webhook hizo la transición — Mercado
    // Pago reintenta webhooks, y si un intento anterior cambió el status
    // pero se cayó antes de acreditar el saldo, este intento debe poder
    // completarlo. Idempotente por (order_id, type), así que no hay riesgo
    // de duplicar si ya se había acreditado.
    const orderForWallet = updatedOrder ?? (
      await supabase
        .from('orders')
        .select('listing_id, buyer_id, seller_id, amount, commission, processing_fee')
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
    }

    // Solo marcamos la prenda vendida la primera vez que la orden pasa a pagada
    // (evita reprocesar si Mercado Pago reenvía el mismo webhook).
    if (updatedOrder) {
      const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
        supabase.from('listings').update({ status: 'sold' }).eq('id', updatedOrder.listing_id)
          .select('title, source_type, international_lead_time_min_days, international_lead_time_max_days').single(),
        supabase.from('profiles').select('email, name').eq('id', updatedOrder.buyer_id).single(),
        supabase.from('profiles').select('email, name').eq('id', updatedOrder.seller_id).single(),
      ])

      const listingTitle = listing?.title ?? 'tu prenda'
      // "amount" (prenda + Protección Bdress) es la base de la comisión y del
      // pago a la vendedora — no incluye el envío a propósito, porque ese
      // dinero no le corresponde a Bdress ni a la vendedora, va al courier.
      // Pero Mercado Pago SÍ le cobra el envío a la compradora como línea
      // aparte (ver api/payment/create), así que el total que le mostramos
      // acá tiene que sumarlo o no coincide con lo que realmente pagó.
      const totalPaidFmt = `$${(updatedOrder.amount + (updatedOrder.shipping_cost ?? 0)).toLocaleString('es-CL')}`
      const sellerNetFmt = `$${(updatedOrder.amount - updatedOrder.commission - updatedOrder.processing_fee).toLocaleString('es-CL')}`
      const isInternational = listing?.source_type === 'international_on_demand'

      if (isInternational) {
        // Carril de estado internacional, separado de orders.status — arranca
        // en validación manual (ver sección 9 del encargo: "generar una tarea
        // administrativa urgente" en vez de despachar directo).
        await supabase.from('orders').update({ international_status: 'awaiting_source_verification' }).eq('id', orderId)
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          previous_status: null,
          new_status: 'awaiting_source_verification',
          changed_by: null,
          public_note: 'Recibimos tu compra. Estamos procesando tu pedido.',
        })
        await supabase.from('international_events').insert({
          event_type: 'international_order_paid',
          listing_id: updatedOrder.listing_id,
          order_id: orderId,
          user_id: updatedOrder.buyer_id,
        })

        if (buyer?.email) {
          await sendInternationalOrderReceivedEmail({
            to: buyer.email,
            name: buyer.name,
            listingTitle,
            minDays: listing?.international_lead_time_min_days,
            maxDays: listing?.international_lead_time_max_days,
          })
        }

        if (process.env.ADMIN_EMAIL) {
          await sendInternationalAdminActionNeededEmail({
            to: process.env.ADMIN_EMAIL,
            orderId,
            listingTitle,
            amountFmt: totalPaidFmt,
            buyerName: buyer?.name ?? buyer?.email ?? 'sin datos',
          })
        }
      } else {
        if (buyer?.email) {
          await sendEmail({
            to: buyer.email,
            subject: `Confirmamos tu compra — ${listingTitle}`,
            html: emailLayout('Compra confirmada', `
              <p style="font-size: 14px; color: #444; line-height: 1.6;">
                Hola ${buyer.name ?? ''}, confirmamos tu pago de <strong>${totalPaidFmt}</strong> por <strong>${listingTitle}</strong>.
                La vendedora tiene 5 días hábiles para despacharla — te avisamos apenas la envíe.
              </p>
              <p style="font-size: 13px; color: #888; line-height: 1.6;">
                Si no la despacha a tiempo, cancelamos la compra y te reembolsamos el pago completo.
                Bdress retiene el dinero hasta que confirmes que la recibiste — tu compra está protegida.
              </p>
              <p style="text-align: center; margin-top: 24px;">
                <a href="${SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                  Ver mi compra
                </a>
              </p>
            `),
          })
        }

        if (seller?.email) {
          await sendEmail({
            to: seller.email,
            subject: `¡Vendiste! — ${listingTitle}`,
            html: emailLayout('Nueva venta', `
              <p style="font-size: 14px; color: #444; line-height: 1.6;">
                Hola ${seller.name ?? ''}, ¡vendiste <strong>${listingTitle}</strong>! Vas a recibir <strong>${sellerNetFmt}</strong>.
                Tienes 5 días hábiles para despacharla.
              </p>
              <p style="font-size: 13px; color: #888; line-height: 1.6;">
                Publicar y vender en Bdress Market es gratis — no te cobramos comisión. Al monto de tu prenda solo se
                le descuenta el costo de procesamiento del pago (${Math.round(PROCESSING_FEE_PCT * 100)}% + $${PROCESSING_FEE_FIXED}).
              </p>
              <p style="font-size: 13px; color: #888; line-height: 1.6;">
                Ve a <strong>Mis ventas</strong> y genera la etiqueta de envío — te la mandamos por correo lista para imprimir.
              </p>
              <p style="text-align: center; margin-top: 24px;">
                <a href="${SITE_URL}/dashboard/sales" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                  Ir a Mis ventas
                </a>
              </p>
            `),
          })
        }

        if (process.env.ADMIN_EMAIL) {
          await sendEmail({
            to: process.env.ADMIN_EMAIL,
            subject: `Nueva compra pagada — ${listingTitle}`,
            html: emailLayout('Nueva compra pagada', `
              <p style="font-size: 14px; color: #444; line-height: 1.6;">
                Se pagó la orden <strong>${orderId}</strong> por <strong>${listingTitle}</strong> (${totalPaidFmt}).
                Compradora: ${buyer?.name ?? buyer?.email ?? 'sin datos'}. Vendedora: ${seller?.name ?? seller?.email ?? 'sin datos'}.
              </p>
            `),
          })
        }
      }
    }
  } else if ((payment.status === 'rejected' || payment.status === 'cancelled') && orderId) {
    const supabase = createAdminClient()
    const { data: order } = await supabase
      .from('orders')
      .select('listing_id, buyer_id')
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .maybeSingle()

    if (order) {
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
