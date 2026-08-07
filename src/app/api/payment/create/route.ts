import { createClient } from '@/lib/supabase/server'
import { getShippingQuote } from '@/lib/starken'
import { buyerProtectionFee, paymentProcessingFee } from '@/lib/catalog'
import { INTERNATIONAL_TERMS_VERSION } from '@/lib/international/content'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'No autenticada' }, { status: 401 })
  }

  let listing_id: string
  let internationalConsent = false
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
    internationalConsent = body.international_consent === true

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
    .select('id, title, price, status, seller_id, shipping_size, source_type')
    .eq('id', listing_id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.status !== 'active') return Response.json({ error: 'Esta prenda ya no está disponible' }, { status: 409 })
  if (listing.seller_id === user.id) return Response.json({ error: 'No puedes comprar tu propia prenda' }, { status: 403 })

  // Los productos internacionales por encargo exigen que la compradora haya
  // aceptado explícitamente el plazo y la validación posterior antes de pagar.
  if (listing.source_type === 'international_on_demand' && !internationalConsent) {
    return Response.json({ error: 'Debes aceptar las condiciones del encargo internacional antes de pagar' }, { status: 400 })
  }

  // Si esta compradora tiene una oferta aceptada vigente para esta prenda, paga
  // el precio pactado en vez del precio público — no afecta a otras compradoras.
  const { data: acceptedOffer } = await supabase
    .from('offers')
    .select('offered_price, accepted_expires_at')
    .eq('listing_id', listing_id)
    .eq('buyer_id', user.id)
    .eq('status', 'accepted')
    .gt('accepted_expires_at', new Date().toISOString())
    .maybeSingle()

  const price = acceptedOffer?.offered_price ?? listing.price

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
    declaredValue: price,
  })

  if (!quote) {
    return Response.json({ error: 'No pudimos cotizar el envío a esa comuna' }, { status: 502 })
  }

  const commission = buyerProtectionFee(price)
  const processingFee = paymentProcessingFee(price)

  // Reserva atómica: bloquea el listing, valida su estado y crea (o
  // reutiliza) la única orden pending_payment permitida para esa prenda —
  // evita que dos compradoras terminen pagando la misma prenda (ver
  // create_or_reuse_pending_order en supabase-schema.sql). Esto reemplaza el
  // viejo patrón select-luego-insert, que no era atómico.
  const { data: reservation, error: reservationErr } = await supabase.rpc('create_or_reuse_pending_order', {
    p_listing_id: listing_id,
    p_buyer_id: user.id,
    p_amount: price + commission,
    p_commission: commission,
    p_processing_fee: processingFee,
    p_shipping_cost: quote.price,
    p_courier_service_code: quote.serviceCode,
    p_shipping_name: shipping.shipping_name,
    p_shipping_phone: shipping.shipping_phone,
    p_shipping_address: shipping.shipping_address,
    p_shipping_address_extra: shipping.shipping_address_extra,
    p_shipping_comuna: shipping.shipping_comuna,
    p_shipping_city: shipping.shipping_city,
    p_international_consent: internationalConsent,
    p_international_terms_version: internationalConsent ? INTERNATIONAL_TERMS_VERSION : null,
    p_international_user_agent: internationalConsent ? request.headers.get('user-agent') : null,
  })

  if (reservationErr) {
    if (reservationErr.message.includes('listing_reserved_by_other_buyer')) {
      return Response.json({ error: 'Otra compradora está completando el pago de esta prenda ahora mismo. Intenta en unos minutos.' }, { status: 409 })
    }
    if (reservationErr.message.includes('listing_not_active')) {
      return Response.json({ error: 'Esta prenda ya no está disponible' }, { status: 409 })
    }
    if (reservationErr.message.includes('cannot_buy_own_listing')) {
      return Response.json({ error: 'No puedes comprar tu propia prenda' }, { status: 403 })
    }
    return Response.json({ error: 'Error creando la orden' }, { status: 500 })
  }

  const orderId = reservation?.[0]?.order_id
  if (!orderId) {
    return Response.json({ error: 'Error creando la orden' }, { status: 500 })
  }

  // Crear preferencia de pago en Mercado Pago (Checkout Pro)
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
          unit_price: price,
          currency_id: 'CLP',
        },
        {
          title: 'Protección BDress',
          quantity: 1,
          unit_price: commission,
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
        success: `${SITE_URL}/dashboard/purchases/${orderId}/confirmacion`,
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
