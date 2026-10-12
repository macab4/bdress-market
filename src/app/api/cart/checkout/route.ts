import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShippingQuote } from '@/lib/starken'
import { buyerProtectionFee, paymentProcessingFee } from '@/lib/catalog'
import {
  computeWalletApplication, prorateMercadoPagoItems, prorateWalletAcrossOrders,
  recordPurchaseHold, recordPurchaseCompleted, recordPurchaseCancelled,
  recordPromoPurchaseHold, recordPromoPurchaseCompleted, recordPromoPurchaseCancelled,
  recordSalePending, sendWalletAlertEmail,
} from '@/lib/wallet'
import { finalizeOrderPaid } from '@/lib/orderNotifications'

const MP_ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN!
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

type Shipping = {
  shipping_name: string; shipping_phone: string; shipping_address: string
  shipping_address_extra: string; shipping_comuna: string; shipping_city: string
}

// Checkout de carrito — misma lógica que /api/payment/create (reservar,
// cotizar envío, aplicar saldo, armar preferencia de Mercado Pago), pero
// para varios listings de distintas vendedoras a la vez: una orden
// independiente por vendedora (como siempre — despacho, disputas y reviews
// no cambian), un solo pago de Mercado Pago. Las compras directas de una
// sola prenda siguen pasando por /api/payment/create sin tocar, intactas.
//
// No soporta productos internacionales (international_on_demand) en el
// carrito — exigen consentimiento y plazos propios por ítem, se compran
// aparte desde su propia ficha.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })
  const userId = user.id

  let listingIds: string[]
  let walletAmountRequested = 0
  let shipping: Shipping
  try {
    const body = await request.json()
    if (!Array.isArray(body.listing_ids) || body.listing_ids.length === 0) throw new Error()
    listingIds = Array.from(new Set(body.listing_ids as string[]))
    walletAmountRequested = Number.isFinite(Number(body.wallet_amount_requested)) ? Number(body.wallet_amount_requested) : 0

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
    return Response.json({ error: 'listing_ids requerido' }, { status: 400 })
  }

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, price, status, seller_id, shipping_size, source_type')
    .in('id', listingIds)

  if (!listings || listings.length !== listingIds.length) {
    return Response.json({ error: 'Una de las prendas de tu carrito ya no existe' }, { status: 404 })
  }
  for (const listing of listings) {
    if (listing.status !== 'active') {
      return Response.json({ error: `"${listing.title}" ya no está disponible — sácala del carrito` }, { status: 409 })
    }
    if (listing.seller_id === userId) {
      return Response.json({ error: `"${listing.title}" es tuya — no puedes comprar tu propia prenda` }, { status: 403 })
    }
    if (listing.source_type === 'international_on_demand') {
      return Response.json({ error: `"${listing.title}" es un envío internacional por encargo — se compra aparte desde su ficha, no por carrito` }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Precio por ítem — igual que la compra directa: si hay una oferta
  // aceptada vigente para esta compradora en ese listing, paga el precio
  // pactado en vez del público.
  const { data: acceptedOffers } = await supabase
    .from('offers')
    .select('listing_id, offered_price, accepted_expires_at')
    .in('listing_id', listingIds)
    .eq('buyer_id', userId)
    .eq('status', 'accepted')
    .gt('accepted_expires_at', new Date().toISOString())

  const acceptedPriceByListing = new Map((acceptedOffers ?? []).map(o => [o.listing_id, o.offered_price]))

  // Comuna de cada vendedora — nunca confiamos en lo que mande el cliente.
  const sellerIds = Array.from(new Set(listings.map(l => l.seller_id)))
  const { data: sellers } = await supabase.from('profiles').select('id, comuna').in('id', sellerIds)
  const comunaBySeller = new Map((sellers ?? []).map(s => [s.id, s.comuna]))
  for (const listing of listings) {
    if (!comunaBySeller.get(listing.seller_id)) {
      return Response.json({ error: `La vendedora de "${listing.title}" todavía no configuró su dirección de despacho` }, { status: 409 })
    }
  }

  // Cada vendedora despacha su propio paquete — se cotiza un envío por
  // listing (origen = comuna de esa vendedora), todos en paralelo para no
  // sumar la latencia de N llamadas a Starken en serie dentro de una misma
  // request.
  const price = (listing: typeof listings[number]) => acceptedPriceByListing.get(listing.id) ?? listing.price
  const quotes = await Promise.all(listings.map(listing =>
    getShippingQuote({
      originComuna: comunaBySeller.get(listing.seller_id)!,
      destComuna: shipping.shipping_comuna,
      size: listing.shipping_size,
      declaredValue: price(listing),
    }).then(quote => ({ listing, quote }))
  ))
  const failedQuote = quotes.find(q => !q.quote)
  if (failedQuote) {
    return Response.json({ error: `No pudimos cotizar el envío de "${failedQuote.listing.title}" a esa comuna` }, { status: 502 })
  }

  const items = quotes.map(({ listing, quote }) => {
    const itemPrice = price(listing)
    const commission = buyerProtectionFee(itemPrice)
    const processingFee = paymentProcessingFee(itemPrice)
    const total = itemPrice + commission + quote!.price
    return { listing, price: itemPrice, commission, processingFee, shippingCost: quote!.price, shippingServiceCode: quote!.serviceCode, total }
  })
  const grandTotal = items.reduce((sum, i) => sum + i.total, 0)

  // Pase 1: reservar cada listing (RPC existente, reutilizada en loop en
  // vez de escribir una nueva — cada llamada bloquea y valida SU propio
  // listing, igual que en la compra directa). Si una falla (otra compradora
  // ya la está pagando, por ejemplo), no se deshacen las reservas ya hechas
  // en este mismo request — son holds reales y válidos, se reutilizan solos
  // si la compradora reintenta el checkout del carrito.
  const reservations: { listing: typeof items[number]['listing']; orderId: string }[] = []
  for (const item of items) {
    const { data: reservation, error: reservationErr } = await supabase.rpc('create_or_reuse_pending_order', {
      p_listing_id: item.listing.id,
      p_buyer_id: userId,
      p_amount: item.price + item.commission,
      p_commission: item.commission,
      p_processing_fee: item.processingFee,
      p_shipping_cost: item.shippingCost,
      p_courier_service_code: item.shippingServiceCode,
      p_shipping_name: shipping.shipping_name,
      p_shipping_phone: shipping.shipping_phone,
      p_shipping_address: shipping.shipping_address,
      p_shipping_address_extra: shipping.shipping_address_extra,
      p_shipping_comuna: shipping.shipping_comuna,
      p_shipping_city: shipping.shipping_city,
    })

    if (reservationErr || !reservation?.[0]?.order_id) {
      const msg = reservationErr?.message ?? ''
      const friendly = msg.includes('listing_reserved_by_other_buyer')
        ? `Otra compradora está completando el pago de "${item.listing.title}" ahora mismo. Intenta en unos minutos.`
        : msg.includes('listing_not_active')
        ? `"${item.listing.title}" ya no está disponible`
        : msg.includes('cannot_buy_own_listing')
        ? `"${item.listing.title}" es tuya — no puedes comprar tu propia prenda`
        : msg.includes('seller_on_vacation')
        ? `La vendedora de "${item.listing.title}" está en modo vacaciones y no está recibiendo ventas por ahora`
        : `Error creando la orden de "${item.listing.title}"`
      return Response.json({ error: friendly, reservedCount: reservations.length }, { status: 409 })
    }

    reservations.push({ listing: item.listing, orderId: reservation[0].order_id })
  }

  // Cuánto de cada orden ya tenía un hold de saldo/promo de un intento
  // anterior (mismo criterio que la compra directa: nunca se recalcula ni
  // se reintenta un hold ya fijado).
  const { data: existingStates } = await admin
    .from('orders')
    .select('id, wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
    .in('id', reservations.map(r => r.orderId))

  const existingByOrderId = new Map((existingStates ?? []).map(s => [s.id, s]))
  const alreadyAppliedPromo = (existingStates ?? []).reduce((sum, s) => sum + (s.promo_amount_applied ?? 0), 0)
  const alreadyAppliedWallet = (existingStates ?? []).reduce((sum, s) => sum + (s.wallet_amount_applied ?? 0), 0)

  const { data: account } = await admin
    .from('wallet_accounts')
    .select('available_balance, promo_balance')
    .eq('user_id', userId)
    .maybeSingle()

  const desiredPromo = computeWalletApplication({
    totalAmount: grandTotal, availableBalance: account?.promo_balance ?? 0, requestedAmount: account?.promo_balance ?? 0,
  })
  const desiredWallet = walletAmountRequested > 0
    ? computeWalletApplication({ totalAmount: grandTotal - desiredPromo, availableBalance: account?.available_balance ?? 0, requestedAmount: walletAmountRequested })
    : 0

  // Solo se reparte entre las órdenes que todavía no tienen un hold propio
  // — las que ya lo tienen (reintento) mantienen el suyo tal cual.
  const notYetHeld = reservations.filter(r => !(existingByOrderId.get(r.orderId)?.promo_amount_applied))
  const notYetHeldWallet = reservations.filter(r => !(existingByOrderId.get(r.orderId)?.wallet_amount_applied))
  const itemByListingId = new Map(items.map(i => [i.listing.id, i]))

  const promoAllocation = prorateWalletAcrossOrders({
    orderTotals: notYetHeld.map(r => ({ listingId: r.orderId, total: itemByListingId.get(r.listing.id)!.total })),
    amountApplied: Math.max(0, desiredPromo - alreadyAppliedPromo),
  })
  const walletAllocation = prorateWalletAcrossOrders({
    orderTotals: notYetHeldWallet.map(r => ({ listingId: r.orderId, total: itemByListingId.get(r.listing.id)!.total })),
    amountApplied: Math.max(0, desiredWallet - alreadyAppliedWallet),
  })

  let totalPromoApplied = 0
  let totalWalletApplied = 0
  const perOrderWallet = new Map<string, { promo: number; wallet: number; promoTransactionId: string | null; walletTransactionId: string | null }>()

  for (const { orderId } of reservations) {
    const existing = existingByOrderId.get(orderId)
    let promoAmount = existing?.promo_amount_applied ?? 0
    let promoTransactionId = existing?.promo_transaction_id ?? null
    if (!promoAmount) {
      const toApply = promoAllocation.get(orderId) ?? 0
      if (toApply > 0) {
        const hold = await recordPromoPurchaseHold(admin, { orderId, userId, amount: toApply })
        if (hold.ok && !hold.skipped && hold.transactionId) {
          const { error: updateErr } = await admin.from('orders').update({ promo_amount_applied: toApply, promo_transaction_id: hold.transactionId }).eq('id', orderId)
          if (updateErr) { await sendWalletAlertEmail({ orderId, reason: updateErr.message }) } else { promoAmount = toApply; promoTransactionId = hold.transactionId }
        }
      }
    }

    let walletAmount = existing?.wallet_amount_applied ?? 0
    let walletTransactionId = existing?.wallet_transaction_id ?? null
    if (!walletAmount) {
      const toApply = walletAllocation.get(orderId) ?? 0
      if (toApply > 0) {
        const hold = await recordPurchaseHold(admin, { orderId, userId, amount: toApply })
        if (hold.ok && !hold.skipped && hold.transactionId) {
          const { error: updateErr } = await admin.from('orders').update({ wallet_amount_applied: toApply, wallet_transaction_id: hold.transactionId }).eq('id', orderId)
          if (updateErr) { await sendWalletAlertEmail({ orderId, reason: updateErr.message }) } else { walletAmount = toApply; walletTransactionId = hold.transactionId }
        }
      }
    }

    perOrderWallet.set(orderId, { promo: promoAmount, wallet: walletAmount, promoTransactionId, walletTransactionId })
    totalPromoApplied += promoAmount
    totalWalletApplied += walletAmount
  }

  if (totalPromoApplied + totalWalletApplied > grandTotal) {
    return Response.json({ error: 'El total de tu carrito cambió y ya no coincide con el saldo reservado. Vuelve a intentar la compra desde el principio.' }, { status: 409 })
  }

  const remaining = grandTotal - totalPromoApplied - totalWalletApplied
  const cartCheckoutId = crypto.randomUUID()
  await admin.from('orders').update({ cart_checkout_id: cartCheckoutId }).in('id', reservations.map(r => r.orderId))

  // Saldo cubre el 100% del carrito — se confirma directo para cada orden,
  // sin pasar por Mercado Pago (mismo camino que la compra directa, en loop).
  if (remaining === 0) {
    for (const { listing, orderId } of reservations) {
      const item = itemByListingId.get(listing.id)!
      const held = perOrderWallet.get(orderId)!
      if (held.promo > 0) {
        const c = await recordPromoPurchaseCompleted(admin, { orderId, userId, amount: held.promo, holdTransactionId: held.promoTransactionId })
        if (!c.ok) await sendWalletAlertEmail({ orderId, reason: c.error })
      }
      if (held.wallet > 0) {
        const c = await recordPurchaseCompleted(admin, { orderId, userId, amount: held.wallet, holdTransactionId: held.walletTransactionId })
        if (!c.ok) await sendWalletAlertEmail({ orderId, reason: c.error })
      }
      await admin.from('orders').update({ status: 'paid', payment_ref: null, paid_at: new Date().toISOString() }).eq('id', orderId)
      const pending = await recordSalePending(admin, { id: orderId, seller_id: listing.seller_id, listing_id: listing.id, amount: item.price + item.commission, commission: item.commission, processing_fee: item.processingFee })
      if (!pending.ok) await sendWalletAlertEmail({ orderId, reason: pending.error })
      await finalizeOrderPaid(admin, { orderId, listingId: listing.id, buyerId: userId, sellerId: listing.seller_id, amount: item.price + item.commission, commission: item.commission, processingFee: item.processingFee, shippingCost: item.shippingCost })
    }
    await admin.from('cart_items').delete().eq('user_id', userId).in('listing_id', reservations.map(r => r.listing.id))
    return Response.json({ redirectUrl: `${SITE_URL}/dashboard/purchases/carrito/${cartCheckoutId}`, walletAmountApplied: totalWalletApplied, promoAmountApplied: totalPromoApplied })
  }

  // Una preferencia de Mercado Pago con los ítems de TODAS las órdenes del
  // carrito — prorateMercadoPagoItems ya sabe filtrar líneas en $0, se
  // reusa una vez por orden con su propio saldo aplicado.
  const mpItems = reservations.flatMap(({ listing, orderId }) => {
    const item = itemByListingId.get(listing.id)!
    const held = perOrderWallet.get(orderId)!
    return prorateMercadoPagoItems({ price: item.price, commission: item.commission, shippingCost: item.shippingCost, walletAmountApplied: held.promo + held.wallet })
      .map(line => ({ title: line.title === 'Prenda' ? listing.title : `${listing.title} — ${line.title}`, quantity: 1, unit_price: line.unitPrice, currency_id: 'CLP' }))
  })

  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    body: JSON.stringify({
      items: mpItems,
      payer: { email: user.email },
      external_reference: cartCheckoutId,
      back_urls: {
        success: `${SITE_URL}/dashboard/purchases/carrito/${cartCheckoutId}`,
        pending: `${SITE_URL}/dashboard/purchases`,
        failure: `${SITE_URL}/cart`,
      },
      auto_return: 'approved',
      notification_url: `${SITE_URL}/api/payment/confirm`,
    }),
  })

  async function cancelAll(reason: string) {
    await admin.from('orders').update({ status: 'cancelled' }).in('id', reservations.map(r => r.orderId))
    for (const { orderId } of reservations) {
      const held = perOrderWallet.get(orderId)!
      if (held.promo > 0) await recordPromoPurchaseCancelled(admin, { orderId, userId, amount: held.promo, reason, holdTransactionId: held.promoTransactionId })
      if (held.wallet > 0) await recordPurchaseCancelled(admin, { orderId, userId, amount: held.wallet, reason, holdTransactionId: held.walletTransactionId })
    }
  }

  if (!mpRes.ok) {
    await cancelAll('mercadopago_preference_failed')
    return Response.json({ error: 'Error al conectar con Mercado Pago' }, { status: 502 })
  }

  const preference = await mpRes.json()
  if (!preference.init_point) {
    await cancelAll('mercadopago_preference_failed')
    return Response.json({ error: preference.message ?? 'Error en Mercado Pago' }, { status: 502 })
  }

  await admin.from('orders').update({ payment_ref: preference.id }).in('id', reservations.map(r => r.orderId))

  return Response.json({ redirectUrl: preference.init_point, walletAmountApplied: totalWalletApplied, promoAmountApplied: totalPromoApplied })
}
