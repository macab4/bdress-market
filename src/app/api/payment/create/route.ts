import { createClient } from '@/lib/supabase/server'
import { getShippingQuote } from '@/lib/chilexpress'
import { buyerProtectionFee, paymentProcessingFee } from '@/lib/catalog'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticada' }, { status: 401 })
  }

  let listing_id: string
  let shipping: {
    shipping_name: string
    shipping_phone: string
    shipping_address: string
    shipping_address_extra: string
    shipping_comuna: string
    shipping_city: string
  }
  try {
    const body = await request.json()
    listing_id = body.listing_id
    if (!listing_id) throw new Error()

    const required = ['shipping_name', 'shipping_phone', 'shipping_address', 'shipping_comuna', 'shipping_city']
    for (const field of required) {
      if (!body[field] || typeof body[field] !== 'string') {
        return Response.json({ error: 'Faltan datos de envío' }, { status: 400 })
      }
    }
    shipping = {
      shipping_name: body.shipping_name,
      shipping_phone: body.shipping_phone,
      shipping_address: body.shipping_address,
      shipping_address_extra: typeof body.shipping_address_extra === 'string' ? body.shipping_address_extra : '',
      shipping_comuna: body.shipping_comuna,
      shipping_city: body.shipping_city,
    }
  } catch {
    return Response.json({ error: 'listing_id requerido' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, price, status, seller_id, shipping_size')
    .eq('id', listing_id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.status !== 'active') return Response.json({ error: 'Esta prenda ya no está disponible' }, { status: 409 })
  if (listing.seller_id === user.id) return Response.json({ error: 'No puedes comprar tu propia prenda' }, { status: 403 })

  // Nunca confiamos en el costo de envío que manda el cliente — se recotiza acá
  const { data: seller } = await supabase
    .from('profiles')
    .select('comuna')
    .eq('id', listing.seller_id)
    .single()

  if (!seller?.comuna) {
    return Response.json({ error: 'La vendedora todavía no configuró su dirección de despacho' }, { status: 409 })
  }

  const quote = await getShippingQuote({
    originComuna: seller.comuna,
    destComuna: shipping.shipping_comuna,
    size: listing.shipping_size,
    declaredValue: listing.price,
  })

  if (!quote) {
    return Response.json({ error: 'No pudimos cotizar el envío a esa comuna' }, { status: 502 })
  }

  // Evitar órdenes duplicadas activas
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .eq('status', 'pending_payment')
    .maybeSingle()

  let orderId: string

  if (existing) {
    orderId = existing.id
    await supabase.from('orders').update({
      ...shipping,
      shipping_cost: quote.price,
      courier_service_code: quote.serviceCode,
    }).eq('id', orderId)
  } else {
    const commission = buyerProtectionFee(listing.price)
    const processingFee = paymentProcessingFee(listing.price)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        listing_id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: listing.price + commission,
        commission,
        processing_fee: processingFee,
        shipping_cost: quote.price,
        courier_service_code: quote.serviceCode,
        status: 'pending_payment',
        ...shipping,
      })
      .select('id')
      .single()

    if (orderErr || !order) {
      return Response.json({ error: 'Error creando la orden' }, { status: 500 })
    }
    orderId = order.id
  }

  // Crear preferencia de pago en Mercado Pago (Checkout Pro)
  const commissionForMp = buyerProtectionFee(listing.price)
  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: listing.title,
          quantity: 1,
          unit_price: listing.price,
          currency_id: 'CLP',
        },
        {
          title: 'Protección BDress',
          quantity: 1,
          unit_price: commissionForMp,
          currency_id: 'CLP',
        },
        {
          title: 'Envío',
          quantity: 1,
          unit_price: quote.price,
          currency_id: 'CLP',
        },
      ],
      payer: { email: user.email },
      external_reference: orderId,
      back_urls: {
        success: `${SITE_URL}/dashboard/purchases`,
        pending: `${SITE_URL}/dashboard/purchases`,
        failure: `${SITE_URL}/listings/${listing_id}`,
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/api/payment/confirm`,
    }),
  })

  if (!mpRes.ok) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return Response.json({ error: 'Error al conectar con Mercado Pago' }, { status: 502 })
  }

  const preference = await mpRes.json()
  if (!preference.init_point) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return Response.json({ error: preference.message ?? 'Error en Mercado Pago' }, { status: 502 })
  }

  // Guardar referencia de la preferencia en la orden
  await supabase.from('orders').update({ payment_ref: preference.id }).eq('id', orderId)

  return Response.json({ redirectUrl: preference.init_point })
}
