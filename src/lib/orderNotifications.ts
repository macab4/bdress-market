import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout, sendInternationalOrderReceivedEmail, sendInternationalAdminActionNeededEmail } from '@/lib/email'
import { PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED } from '@/lib/catalog'

type AdminClient = ReturnType<typeof createAdminClient>

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// Todo lo que pasa la PRIMERA vez que una orden queda pagada — marcar la
// prenda vendida, arrancar el carril internacional si corresponde, y
// mandar los 3 emails (compradora/vendedora/admin). Extraído tal cual
// (sin reescribir el HTML ni la lógica) del webhook de Mercado Pago
// (payment/confirm/route.ts), porque el camino "100% pagado con saldo"
// (payment/create/route.ts, fase 3) necesita hacer exactamente lo mismo
// sin pasar por Mercado Pago.
export async function finalizeOrderPaid(admin: AdminClient, order: {
  orderId: string
  listingId: string
  buyerId: string
  sellerId: string
  amount: number
  commission: number
  processingFee: number
  shippingCost: number
}): Promise<void> {
  const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
    admin.from('listings').update({ status: 'sold' }).eq('id', order.listingId)
      .select('title, source_type, international_lead_time_min_days, international_lead_time_max_days').single(),
    admin.from('profiles').select('email, name').eq('id', order.buyerId).single(),
    admin.from('profiles').select('email, name').eq('id', order.sellerId).single(),
  ])

  const listingTitle = listing?.title ?? 'tu prenda'
  // "amount" (prenda + Protección Bdress) es la base de la comisión y del
  // pago a la vendedora — no incluye el envío a propósito, porque ese
  // dinero no le corresponde a Bdress ni a la vendedora, va al courier.
  // Pero a la compradora sí se le cobra el envío como línea aparte (ver
  // payment/create), así que el total que le mostramos acá tiene que
  // sumarlo o no coincide con lo que realmente pagó.
  const totalPaidFmt = `$${(order.amount + (order.shippingCost ?? 0)).toLocaleString('es-CL')}`
  const sellerNetFmt = `$${(order.amount - order.commission - order.processingFee).toLocaleString('es-CL')}`
  const isInternational = listing?.source_type === 'international_on_demand'

  if (isInternational) {
    // Carril de estado internacional, separado de orders.status — arranca
    // en validación manual (ver sección 9 del encargo: "generar una tarea
    // administrativa urgente" en vez de despachar directo).
    await admin.from('orders').update({ international_status: 'awaiting_source_verification' }).eq('id', order.orderId)
    await admin.from('order_status_history').insert({
      order_id: order.orderId,
      previous_status: null,
      new_status: 'awaiting_source_verification',
      changed_by: null,
      public_note: 'Recibimos tu compra. Estamos procesando tu pedido.',
    })
    await admin.from('international_events').insert({
      event_type: 'international_order_paid',
      listing_id: order.listingId,
      order_id: order.orderId,
      user_id: order.buyerId,
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
        orderId: order.orderId,
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
            Se pagó la orden <strong>${order.orderId}</strong> por <strong>${listingTitle}</strong> (${totalPaidFmt}).
            Compradora: ${buyer?.name ?? buyer?.email ?? 'sin datos'}. Vendedora: ${seller?.name ?? seller?.email ?? 'sin datos'}.
          </p>
        `),
      })
    }
  }
}
