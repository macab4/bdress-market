import { createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'

const FLOW_API_URL = process.env.FLOW_API_URL!
const FLOW_API_KEY = process.env.FLOW_API_KEY!
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const COMMISSION_PCT = parseInt(process.env.BDRESS_COMMISSION_PCT ?? '12') / 100

function flowSign(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('')
  return createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex')
}

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
    .select('id, title, price, status, seller_id')
    .eq('id', listing_id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.status !== 'active') return Response.json({ error: 'Esta prenda ya no está disponible' }, { status: 409 })
  if (listing.seller_id === user.id) return Response.json({ error: 'No puedes comprar tu propia prenda' }, { status: 403 })

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
    await supabase.from('orders').update(shipping).eq('id', orderId)
  } else {
    const commission = Math.round(listing.price * COMMISSION_PCT)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        listing_id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: listing.price,
        commission,
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

  // Crear pago en Flow.cl
  const buyerEmail = user.email ?? ''

  const params: Record<string, string | number> = {
    apiKey: FLOW_API_KEY,
    amount: listing.price,
    commerceOrder: orderId,
    currency: 'CLP',
    email: buyerEmail,
    subject: `Bdress Market — ${listing.title}`,
    urlConfirmation: `${SITE_URL}/api/payment/confirm`,
    urlReturn: `${SITE_URL}/dashboard/purchases`,
  }

  const signature = flowSign(params)
  const formParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => formParams.append(k, String(v)))
  formParams.append('s', signature)

  const flowRes = await fetch(`${FLOW_API_URL}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formParams.toString(),
  })

  if (!flowRes.ok) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return Response.json({ error: 'Error al conectar con Flow' }, { status: 502 })
  }

  const flowData = await flowRes.json()
  if (!flowData.url || !flowData.token) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    return Response.json({ error: flowData.message ?? 'Error en Flow' }, { status: 502 })
  }

  // Guardar flow token en la orden
  await supabase.from('orders').update({ flow_order_id: flowData.token }).eq('id', orderId)

  return Response.json({ redirectUrl: `${flowData.url}?token=${flowData.token}` })
}
