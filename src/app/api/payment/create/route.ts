import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShippingQuote } from '@/lib/starken'
import { buyerProtectionFee, paymentProcessingFee } from '@/lib/catalog'
import { INTERNATIONAL_TERMS_VERSION } from '@/lib/international/content'
import {
  computeWalletApplication, prorateMercadoPagoItems, recordPurchaseHold, recordPurchaseCompleted, recordPurchaseCancelled,
  recordPromoPurchaseHold, recordPromoPurchaseCompleted, recordPromoPurchaseCancelled, recordSalePending, sendWalletAlertEmail,
} from '@/lib/wallet'
import { finalizeOrderPaid } from '@/lib/orderNotifications'

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
  let walletAmountRequested = 0
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
    // Nunca se confía en este número a ciegas — se capea server-side contra
    // el saldo disponible real y el total de la orden (ver
    // computeWalletApplication más abajo).
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
  const totalAPagar = price + commission + quote.price

  // Cuánto de este total puede cubrirse con saldo B-Dress y con Crédito
  // B-Dress (promocional) — el saldo real se lee server-side (nunca se
  // confía en lo que manda el cliente) con el cliente admin, porque el hold
  // en sí (más abajo) solo lo puede hacer service_role.
  const admin = createAdminClient()
  const { data: account } = await admin
    .from('wallet_accounts')
    .select('available_balance, promo_balance')
    .eq('user_id', user.id)
    .maybeSingle()

  // El Crédito B-Dress se aplica SIEMPRE que exista, sin que la compradora
  // tenga que pedirlo — es el saldo más restringido (solo sirve para
  // comprar, ver sección 12 del encargo de referidos), así que conviene
  // gastarlo primero. El saldo de ventas (available_balance) sigue siendo
  // opt-in vía el checkbox existente en CheckoutForm.
  let promoAmountApplied = computeWalletApplication({
    totalAmount: totalAPagar,
    availableBalance: account?.promo_balance ?? 0,
    requestedAmount: account?.promo_balance ?? 0,
  })
  let promoTransactionId: string | null = null

  let walletAmountApplied = 0
  let walletTransactionId: string | null = null
  if (walletAmountRequested > 0) {
    walletAmountApplied = computeWalletApplication({
      totalAmount: totalAPagar - promoAmountApplied,
      availableBalance: account?.available_balance ?? 0,
      requestedAmount: walletAmountRequested,
    })
  }

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
    if (reservationErr.message.includes('seller_on_vacation')) {
      return Response.json({ error: 'Esta vendedora está en modo vacaciones y no está recibiendo ventas por ahora' }, { status: 409 })
    }
    return Response.json({ error: 'Error creando la orden' }, { status: 500 })
  }

  const orderId = reservation?.[0]?.order_id
  if (!orderId) {
    return Response.json({ error: 'Error creando la orden' }, { status: 500 })
  }

  // La orden puede haber sido reutilizada de un intento anterior (mismo
  // listing, mismo/otro reintento de la misma compradora dentro de la
  // ventana de reserva) — si ya tiene un hold de saldo y/o de Crédito
  // B-Dress, se reusa TAL CUAL, nunca se vuelve a calcular ni se re-intenta
  // el hold (ver comentario de wallet_amount_applied en la migración de
  // fase 3, y el mismo criterio aplicado a promo_amount_applied).
  const { data: existingWalletState } = await admin
    .from('orders')
    .select('wallet_amount_applied, wallet_transaction_id, promo_amount_applied, promo_transaction_id')
    .eq('id', orderId)
    .single()

  if (existingWalletState && existingWalletState.promo_amount_applied > 0) {
    promoAmountApplied = existingWalletState.promo_amount_applied
    promoTransactionId = existingWalletState.promo_transaction_id
  } else if (promoAmountApplied > 0) {
    const promoHold = await recordPromoPurchaseHold(admin, { orderId, userId: user.id, amount: promoAmountApplied })
    if (promoHold.ok && !promoHold.skipped && promoHold.transactionId) {
      const { error: updateErr } = await admin
        .from('orders')
        .update({ promo_amount_applied: promoAmountApplied, promo_transaction_id: promoHold.transactionId })
        .eq('id', orderId)
      if (updateErr) {
        await sendWalletAlertEmail({ orderId, reason: updateErr.message })
        promoAmountApplied = 0
      } else {
        promoTransactionId = promoHold.transactionId
      }
    } else {
      // Saldo promocional insuficiente en una carrera u otro error del RPC
      // — degrada de forma segura, el resto de la compra sigue su curso
      // normal (saldo de ventas y/o Mercado Pago).
      promoAmountApplied = 0
    }
  }

  if (existingWalletState && existingWalletState.wallet_amount_applied > 0) {
    walletAmountApplied = existingWalletState.wallet_amount_applied
    walletTransactionId = existingWalletState.wallet_transaction_id
  } else if (walletAmountApplied > 0) {
    const hold = await recordPurchaseHold(admin, { orderId, userId: user.id, amount: walletAmountApplied })
    if (hold.ok && !hold.skipped && hold.transactionId) {
      const { error: updateErr } = await admin
        .from('orders')
        .update({ wallet_amount_applied: walletAmountApplied, wallet_transaction_id: hold.transactionId })
        .eq('id', orderId)
      if (updateErr) {
        // El hold ya quedó en el ledger pero no se pudo registrar en la
        // orden — no arriesgamos aplicar un descuento que la orden no
        // refleja; se alerta para corrección manual y esta compra sigue
        // 100% por Mercado Pago.
        await sendWalletAlertEmail({ orderId, reason: updateErr.message })
        walletAmountApplied = 0
      } else {
        walletTransactionId = hold.transactionId
      }
    } else {
      // Saldo insuficiente en una carrera (otra pestaña/compra lo gastó
      // primero) u otro error del RPC — degrada de forma segura a pagar
      // 100% por Mercado Pago, la orden sigue siendo válida.
      walletAmountApplied = 0
    }
  }

  // Límite de esta fase: si el total recalculado bajó por debajo de un hold
  // ya fijado en un reintento anterior (ej. la compradora cambió a un envío
  // más barato), no se ajusta el hold — se le pide reiniciar la compra en
  // vez de dejar un estado contable inconsistente.
  if (promoAmountApplied + walletAmountApplied > totalAPagar) {
    return Response.json({ error: 'El total de tu pedido cambió y ya no coincide con el saldo reservado. Vuelve a intentar la compra desde el principio.' }, { status: 409 })
  }

  const remaining = totalAPagar - promoAmountApplied - walletAmountApplied

  // El saldo (real y/o promocional) cubre el 100% del total — se confirma
  // directo, sin pasar por Mercado Pago.
  if (remaining === 0) {
    if (promoAmountApplied > 0) {
      const promoCompleted = await recordPromoPurchaseCompleted(admin, {
        orderId, userId: user.id, amount: promoAmountApplied, holdTransactionId: promoTransactionId,
      })
      if (!promoCompleted.ok) await sendWalletAlertEmail({ orderId, reason: promoCompleted.error })
    }
    if (walletAmountApplied > 0) {
      const completed = await recordPurchaseCompleted(admin, {
        orderId, userId: user.id, amount: walletAmountApplied, holdTransactionId: walletTransactionId,
      })
      if (!completed.ok) await sendWalletAlertEmail({ orderId, reason: completed.error })
    }

    // payment_ref queda null a propósito — así el refund (admin/orders/[id]/resolve)
    // sabe sin ambigüedad que no hay nada que reembolsar por Mercado Pago.
    await admin.from('orders').update({ status: 'paid', payment_ref: null, paid_at: new Date().toISOString() }).eq('id', orderId)

    // Mismo movimiento que hace payment/confirm en el camino con Mercado
    // Pago — acá no hay webhook que lo dispare, así que hay que llamarlo acá
    // mismo o la vendedora nunca vería el saldo pendiente de esta venta.
    const pending = await recordSalePending(admin, {
      id: orderId, seller_id: listing.seller_id, listing_id: listing.id,
      amount: price + commission, commission, processing_fee: processingFee,
    })
    if (!pending.ok) await sendWalletAlertEmail({ orderId, reason: pending.error })

    await finalizeOrderPaid(admin, {
      orderId,
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.seller_id,
      amount: price + commission,
      commission,
      processingFee,
      shippingCost: quote.price,
    })

    return Response.json({ redirectUrl: `${SITE_URL}/dashboard/purchases/${orderId}/confirmacion`, walletAmountApplied, promoAmountApplied })
  }

  // Crear preferencia de pago en Mercado Pago (Checkout Pro) — por lo que
  // falta cubrir después del Crédito B-Dress y el saldo de ventas aplicados
  // (0 si no se usó ninguno). A prorateMercadoPagoItems no le importa de
  // qué bucket vino cada peso, solo cuánto ya está cubierto en total.
  const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      items: prorateMercadoPagoItems({ price, commission, shippingCost: quote.price, walletAmountApplied: promoAmountApplied + walletAmountApplied }).map(item => ({
        title: item.title === 'Prenda' ? listing.title : item.title,
        quantity: 1,
        unit_price: item.unitPrice,
        currency_id: 'CLP',
      })),
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
    if (promoAmountApplied > 0) {
      await recordPromoPurchaseCancelled(admin, {
        orderId, userId: user.id, amount: promoAmountApplied, reason: 'mercadopago_preference_failed', holdTransactionId: promoTransactionId,
      })
    }
    if (walletAmountApplied > 0) {
      await recordPurchaseCancelled(admin, {
        orderId, userId: user.id, amount: walletAmountApplied, reason: 'mercadopago_preference_failed', holdTransactionId: walletTransactionId,
      })
    }
    return Response.json({ error: 'Error al conectar con Mercado Pago' }, { status: 502 })
  }

  const preference = await mpRes.json()
  if (!preference.init_point) {
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    if (promoAmountApplied > 0) {
      await recordPromoPurchaseCancelled(admin, {
        orderId, userId: user.id, amount: promoAmountApplied, reason: 'mercadopago_preference_failed', holdTransactionId: promoTransactionId,
      })
    }
    if (walletAmountApplied > 0) {
      await recordPurchaseCancelled(admin, {
        orderId, userId: user.id, amount: walletAmountApplied, reason: 'mercadopago_preference_failed', holdTransactionId: walletTransactionId,
      })
    }
    return Response.json({ error: preference.message ?? 'Error en Mercado Pago' }, { status: 502 })
  }

  // Guardar referencia de la preferencia en la orden
  await supabase.from('orders').update({ payment_ref: preference.id }).eq('id', orderId)

  return Response.json({ redirectUrl: preference.init_point, walletAmountApplied, promoAmountApplied })
}
