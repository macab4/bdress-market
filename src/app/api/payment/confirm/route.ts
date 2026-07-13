import { createClient as createServiceClient } from '@supabase/supabase-js'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!

// Service role client bypasses RLS — necesario porque Mercado Pago llama sin cookies de usuario
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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
    const supabase = getServiceClient()
    const { data: updatedOrder } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', orderId)
      .eq('status', 'pending_payment')
      .select('listing_id')
      .maybeSingle()

    // Solo marcamos la prenda vendida la primera vez que la orden pasa a pagada
    // (evita reprocesar si Mercado Pago reenvía el mismo webhook).
    if (updatedOrder) {
      await supabase
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', updatedOrder.listing_id)
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
