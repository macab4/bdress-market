import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailLayout } from '@/lib/email'
import { OFFER_EXPIRY_HOURS, minOfferPrice } from '@/lib/catalog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let offeredPrice: number
  try {
    const body = await request.json()
    offeredPrice = Math.round(Number(body.offered_price))
    if (!Number.isFinite(offeredPrice) || offeredPrice <= 0) throw new Error()
  } catch {
    return Response.json({ error: 'offered_price inválido' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, title, price, status, seller_id')
    .eq('id', listingId)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.status !== 'active') return Response.json({ error: 'Esta prenda ya no está disponible' }, { status: 409 })
  if (listing.seller_id === user.id) return Response.json({ error: 'No puedes ofertar por tu propia prenda' }, { status: 403 })

  if (offeredPrice >= listing.price) {
    return Response.json({ error: 'La oferta debe ser menor al precio publicado' }, { status: 400 })
  }
  const minPrice = minOfferPrice(listing.price)
  if (offeredPrice < minPrice) {
    return Response.json({ error: `La oferta mínima es $${minPrice.toLocaleString('es-CL')}` }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('offers')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return Response.json({ error: 'Ya tienes una oferta pendiente para esta prenda' }, { status: 409 })
  }

  const expiresAt = new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      original_price: listing.price,
      offered_price: offeredPrice,
      proposed_by: 'buyer',
      status: 'pending',
      round: 1,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !offer) return Response.json({ error: error?.message ?? 'Error creando la oferta' }, { status: 500 })

  const { data: seller } = await supabase.from('profiles').select('email, name').eq('id', listing.seller_id).single()
  if (seller?.email) {
    await sendEmail({
      to: seller.email,
      subject: `Recibiste una oferta — ${listing.title}`,
      html: emailLayout('Nueva oferta', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${seller.name ?? ''}, te ofrecieron <strong>$${offeredPrice.toLocaleString('es-CL')}</strong> por
          <strong>${listing.title}</strong> (precio publicado: $${listing.price.toLocaleString('es-CL')}).
          Tienes ${OFFER_EXPIRY_HOURS} horas para responder antes de que expire.
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/offers" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver la oferta
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true, id: offer.id })
}
