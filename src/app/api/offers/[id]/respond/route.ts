import { createClient } from '@/lib/supabase/server'
import { sendEmail, emailLayout } from '@/lib/email'
import { OFFER_EXPIRY_HOURS, OFFER_MAX_ROUNDS, OFFER_ACCEPTED_HOLD_HOURS, minOfferPrice } from '@/lib/catalog'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const ACTIONS = ['accept', 'reject', 'counter']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let action: string
  let counterPrice: number | null = null
  try {
    const body = await request.json()
    action = body.action
    if (!ACTIONS.includes(action)) throw new Error()
    if (action === 'counter') {
      counterPrice = Math.round(Number(body.offered_price))
      if (!Number.isFinite(counterPrice) || counterPrice <= 0) throw new Error()
    }
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { data: offer } = await supabase
    .from('offers')
    .select('id, listing_id, buyer_id, seller_id, original_price, offered_price, proposed_by, status, round, expires_at')
    .eq('id', id)
    .single()

  if (!offer) return Response.json({ error: 'Oferta no encontrada' }, { status: 404 })
  if (offer.buyer_id !== user.id && offer.seller_id !== user.id) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Solo puede responder quien NO hizo la última propuesta.
  const responderRole = offer.seller_id === user.id ? 'seller' : 'buyer'
  if (offer.proposed_by === responderRole) {
    return Response.json({ error: 'Estás esperando la respuesta de la otra parte' }, { status: 409 })
  }

  if (offer.status !== 'pending') {
    return Response.json({ error: 'Esta oferta ya no está pendiente' }, { status: 409 })
  }
  if (new Date(offer.expires_at) < new Date()) {
    await supabase.from('offers').update({ status: 'expired' }).eq('id', id)
    return Response.json({ error: 'Esta oferta ya expiró' }, { status: 409 })
  }

  const { data: listing } = await supabase.from('listings').select('title').eq('id', offer.listing_id).single()
  const listingTitle = listing?.title ?? 'tu prenda'

  const [{ data: buyer }, { data: seller }] = await Promise.all([
    supabase.from('profiles').select('email, name').eq('id', offer.buyer_id).single(),
    supabase.from('profiles').select('email, name').eq('id', offer.seller_id).single(),
  ])

  if (action === 'reject') {
    const { error } = await supabase.from('offers').update({ status: 'rejected' }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const proposer = offer.proposed_by === 'buyer' ? buyer : seller
    if (proposer?.email) {
      await sendEmail({
        to: proposer.email,
        subject: `Rechazaron tu oferta — ${listingTitle}`,
        html: emailLayout('Oferta rechazada', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Hola ${proposer.name ?? ''}, tu oferta de $${offer.offered_price.toLocaleString('es-CL')} por
            <strong>${listingTitle}</strong> fue rechazada.
          </p>
        `),
      })
    }
    return Response.json({ ok: true, status: 'rejected' })
  }

  if (action === 'accept') {
    const acceptedExpiresAt = new Date(Date.now() + OFFER_ACCEPTED_HOLD_HOURS * 60 * 60 * 1000).toISOString()
    const { error } = await supabase
      .from('offers')
      .update({ status: 'accepted', accepted_expires_at: acceptedExpiresAt })
      .eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // El artículo ya se vende a este precio — el resto de las ofertas pendientes de
    // otras compradoras sobre la misma prenda quedan sin efecto.
    await supabase
      .from('offers')
      .update({ status: 'cancelled' })
      .eq('listing_id', offer.listing_id)
      .eq('status', 'pending')
      .neq('id', id)

    if (buyer?.email) {
      await sendEmail({
        to: buyer.email,
        subject: `¡Aceptaron tu oferta! — ${listingTitle}`,
        html: emailLayout('Oferta aceptada', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Hola ${buyer.name ?? ''}, la vendedora aceptó tu oferta de
            <strong>$${offer.offered_price.toLocaleString('es-CL')}</strong> por <strong>${listingTitle}</strong>.
            Tienes ${OFFER_ACCEPTED_HOLD_HOURS} horas para completar la compra a ese precio.
          </p>
          <p style="text-align: center; margin-top: 24px;">
            <a href="${SITE_URL}/listings/${offer.listing_id}/checkout" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
              Comprar al precio pactado
            </a>
          </p>
        `),
      })
    }
    if (seller?.email) {
      await sendEmail({
        to: seller.email,
        subject: `Aceptaste una oferta — ${listingTitle}`,
        html: emailLayout('Oferta aceptada', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Hola ${seller.name ?? ''}, aceptaste vender <strong>${listingTitle}</strong> en
            $${offer.offered_price.toLocaleString('es-CL')}. La compradora tiene ${OFFER_ACCEPTED_HOLD_HOURS} horas
            para pagar a ese precio.
          </p>
        `),
      })
    }
    return Response.json({ ok: true, status: 'accepted' })
  }

  // action === 'counter'
  if (offer.round >= OFFER_MAX_ROUNDS) {
    return Response.json({ error: 'Se alcanzó el máximo de contraofertas — solo puedes aceptar o rechazar' }, { status: 409 })
  }
  if (counterPrice! >= offer.original_price) {
    return Response.json({ error: 'La contraoferta debe ser menor al precio publicado' }, { status: 400 })
  }
  const minPrice = minOfferPrice(offer.original_price)
  if (counterPrice! < minPrice) {
    return Response.json({ error: `La contraoferta mínima es $${minPrice.toLocaleString('es-CL')}` }, { status: 400 })
  }

  const { error: updateError } = await supabase.from('offers').update({ status: 'countered' }).eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  const newExpiresAt = new Date(Date.now() + OFFER_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
  const { data: newOffer, error: insertError } = await supabase
    .from('offers')
    .insert({
      listing_id: offer.listing_id,
      buyer_id: offer.buyer_id,
      seller_id: offer.seller_id,
      original_price: offer.original_price,
      offered_price: counterPrice,
      proposed_by: responderRole,
      status: 'pending',
      round: offer.round + 1,
      parent_offer_id: offer.id,
      expires_at: newExpiresAt,
    })
    .select('id')
    .single()

  if (insertError || !newOffer) {
    return Response.json({ error: insertError?.message ?? 'Error creando la contraoferta' }, { status: 500 })
  }

  const recipient = responderRole === 'seller' ? buyer : seller
  if (recipient?.email) {
    await sendEmail({
      to: recipient.email,
      subject: `Te hicieron una contraoferta — ${listingTitle}`,
      html: emailLayout('Contraoferta', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${recipient.name ?? ''}, ${responderRole === 'seller' ? 'la vendedora' : 'la compradora'} propuso
          <strong>$${counterPrice!.toLocaleString('es-CL')}</strong> por <strong>${listingTitle}</strong>.
          Tienes ${OFFER_EXPIRY_HOURS} horas para responder.
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/offers" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver la contraoferta
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true, status: 'countered', id: newOffer.id })
}
