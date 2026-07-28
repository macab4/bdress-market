import { createClient } from '@/lib/supabase/server'
import { BOOST_PRICE } from '@/lib/catalog'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let listing_id: string
  try {
    const body = await request.json()
    listing_id = body.listing_id
    if (!listing_id) throw new Error()
  } catch {
    return Response.json({ error: 'listing_id requerido' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, status, seller_id')
    .eq('id', listing_id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (listing.status !== 'active') return Response.json({ error: 'Solo puedes destacar una prenda activa' }, { status: 409 })

  const { data: boost, error: boostErr } = await supabase
    .from('listing_boosts')
    .insert({
      listing_id,
      seller_id: user.id,
      amount: BOOST_PRICE,
      status: 'pending_payment',
    })
    .select('id')
    .single()

  if (boostErr || !boost) {
    return Response.json({ error: 'Error creando el boost' }, { status: 500 })
  }

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: [
        {
          title: `Destacar "${listing.title}" — 3 días`,
          quantity: 1,
          unit_price: BOOST_PRICE,
          currency_id: 'CLP',
        },
      ],
      payer: { email: user.email },
      external_reference: `boost:${boost.id}`,
      back_urls: {
        success: `${SITE_URL}/profile/${user.id}`,
        pending: `${SITE_URL}/profile/${user.id}`,
        failure: `${SITE_URL}/profile/${user.id}`,
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/api/payment/confirm`,
    }),
  })

  if (!mpRes.ok) {
    await supabase.from('listing_boosts').update({ status: 'cancelled' }).eq('id', boost.id)
    return Response.json({ error: 'Error al conectar con Mercado Pago' }, { status: 502 })
  }

  const preference = await mpRes.json()
  if (!preference.init_point) {
    await supabase.from('listing_boosts').update({ status: 'cancelled' }).eq('id', boost.id)
    return Response.json({ error: preference.message ?? 'Error en Mercado Pago' }, { status: 502 })
  }

  await supabase.from('listing_boosts').update({ payment_ref: preference.id }).eq('id', boost.id)

  return Response.json({ redirectUrl: preference.init_point })
}
