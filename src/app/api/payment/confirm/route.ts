import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'

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
  const orderId = payment.external_reference

  if (payment.status === 'approved' && orderId) {
    const supabase = createAdminClient()
    const { data: updatedOrder } = await supabase
      .from('orders')
      .update({ status: 'paid', payment_ref: String(payment.id), paid_at: new Date().toISOString() })
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .select('listing_id, buyer_id, seller_id, amount, commission')
      .maybeSingle()

    // Solo marcamos la prenda vendida la primera vez que la orden pasa a pagada
    // (evita reprocesar si Mercado Pago reenvía el mismo webhook).
    if (updatedOrder) {
      const [{ data: listing }, { data: buyer }, { data: seller }] = await Promise.all([
        supabase.from('listings').update({ status: 'sold' }).eq('id', updatedOrder.listing_id).select('title').single(),
        supabase.from('profiles').select('email, name').eq('id', updatedOrder.buyer_id).single(),
        supabase.from('profiles').select('email, name').eq('id', updatedOrder.seller_id).single(),
      ])

      const listingTitle = listing?.title ?? 'tu prenda'
      const amountFmt = `$${updatedOrder.amount.toLocaleString('es-CL')}`
      const sellerNetFmt = `$${(updatedOrder.amount - updatedOrder.commission).toLocaleString('es-CL')}`

      if (buyer?.email) {
        await sendEmail({
          to: buyer.email,
          subject: `Confirmamos tu compra — ${listingTitle}`,
          html: emailLayout('Compra confirmada', `
            <p style="font-size: 14px; color: #444; line-height: 1.6;">
              Hola ${buyer.name ?? ''}, confirmamos tu pago de <strong>${amountFmt}</strong> por <strong>${listingTitle}</strong>.
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
              Tenés 5 días hábiles para despacharla.
            </p>
            <p style="font-size: 13px; color: #888; line-height: 1.6;">
              Andá a <strong>Mis ventas</strong> y generá la etiqueta de envío — te la mandamos por correo lista para imprimir.
            </p>
            <p style="text-align: center; margin-top: 24px;">
              <a href="${SITE_URL}/dashboard/sales" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
                Ir a Mis ventas
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
