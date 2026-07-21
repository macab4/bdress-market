import { createClient } from '@/lib/supabase/server'
import { getShippingQuote } from '@/lib/starken'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let listing_id: string
  let comuna: string
  try {
    const body = await request.json()
    listing_id = body.listing_id
    comuna = body.comuna
    if (!listing_id || !comuna) throw new Error()
  } catch {
    return Response.json({ error: 'listing_id y comuna requeridos' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('price, shipping_size, seller_id')
    .eq('id', listing_id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })

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
    destComuna: comuna,
    size: listing.shipping_size,
    declaredValue: listing.price,
  })

  if (!quote) {
    return Response.json({ error: 'No pudimos cotizar el envío a esa comuna' }, { status: 502 })
  }

  return Response.json(quote)
}
