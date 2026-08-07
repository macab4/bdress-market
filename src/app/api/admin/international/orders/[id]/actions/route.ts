import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nextInternationalStatus, InvalidInternationalTransitionError, InternationalStatusAction } from '@/lib/international/status'
import { InternationalStatus } from '@/types'
import {
  sendInternationalAvailabilityConfirmedEmail, sendInternationalUnavailableCancelledEmail,
  sendInternationalPurchasedEmail, sendInternationalTransitUpdateEmail, sendInternationalReceivedInChileEmail,
  sendInternationalRefundInitiatedEmail, sendInternationalRefundCompletedEmail,
} from '@/lib/email'

// Toda acción administrativa del carril internacional pasa por un único
// endpoint discriminado por `action` — decisión deliberada para no crear 15
// archivos de ruta casi idénticos. Cada acción que mueve international_status
// queda auditada en order_status_history (changed_by/public_note/internal_note).
// Las acciones sensibles (mark_unavailable, confirm_refund) exigen confirm:true.

const STATE_CHANGING_ACTIONS: InternationalStatusAction[] = [
  'confirm_availability', 'register_external_purchase', 'mark_received_spain', 'mark_in_transit',
  'mark_customs', 'mark_received_chile', 'approve_quality_check', 'prepare_national_shipping',
  'mark_delivered', 'mark_unavailable', 'start_cancellation', 'begin_refund', 'confirm_refund',
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id: orderId } = await params

  let body: { action?: string; payload?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const action = body.action
  const payload = body.payload ?? {}
  if (!action) return Response.json({ error: 'action requerida' }, { status: 400 })

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, listing_id, buyer_id, amount, status, international_status')
    .eq('id', orderId)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.international_status === null && !['add_internal_note', 'add_public_update'].includes(action)) {
    return Response.json({ error: 'Esta orden no es una orden internacional' }, { status: 400 })
  }

  const { data: buyer } = await admin.from('profiles').select('email, name').eq('id', order.buyer_id).single()
  const { data: listing } = await admin.from('listings').select('title').eq('id', order.listing_id).single()
  const listingTitle = listing?.title ?? 'tu prenda'

  async function recordHistory(newStatus: InternationalStatus, previousStatus: InternationalStatus | null, publicNote: string | null, internalNote: string | null) {
    await admin.from('order_status_history').insert({
      order_id: orderId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: user!.id,
      public_note: publicNote,
      internal_note: internalNote,
    })
  }

  // Anotaciones que no mueven el estado — solo dejan constancia.
  if (action === 'add_internal_note' || action === 'add_public_update') {
    const note = typeof payload.note === 'string' ? payload.note : ''
    if (!note.trim()) return Response.json({ error: 'note requerida' }, { status: 400 })
    await recordHistory(
      (order.international_status ?? 'awaiting_source_verification') as InternationalStatus,
      order.international_status as InternationalStatus | null,
      action === 'add_public_update' ? note : null,
      action === 'add_internal_note' ? note : null,
    )
    return Response.json({ ok: true })
  }

  // Solo registra datos administrativos, no mueve el estado.
  if (action === 'register_cost' || action === 'register_tracking') {
    const update: Record<string, unknown> = {}
    if (action === 'register_cost') {
      if (typeof payload.external_purchase_price === 'number') update.external_purchase_price = payload.external_purchase_price
      if (typeof payload.external_purchase_currency === 'string') update.external_purchase_currency = payload.external_purchase_currency
      if (typeof payload.international_customs_estimate === 'number') update.international_customs_estimate = payload.international_customs_estimate
    } else {
      if (typeof payload.external_tracking_number === 'string') update.external_tracking_number = payload.external_tracking_number
      if (typeof payload.external_tracking_url === 'string') update.external_tracking_url = payload.external_tracking_url
    }
    update.updated_at = new Date().toISOString()
    const { error } = await admin.from('listing_sourcing').update(update).eq('listing_id', order.listing_id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (!STATE_CHANGING_ACTIONS.includes(action as InternationalStatusAction)) {
    return Response.json({ error: 'Acción desconocida' }, { status: 400 })
  }

  const sensitiveActions: InternationalStatusAction[] = ['mark_unavailable', 'confirm_refund']
  if (sensitiveActions.includes(action as InternationalStatusAction) && payload.confirm !== true) {
    return Response.json({ error: 'Esta acción requiere confirmación explícita' }, { status: 400 })
  }

  let nextStatus: InternationalStatus
  try {
    nextStatus = nextInternationalStatus(action as InternationalStatusAction, order.international_status as InternationalStatus | null)
  } catch (err) {
    if (err instanceof InvalidInternationalTransitionError) {
      return Response.json({ error: err.message }, { status: 409 })
    }
    throw err
  }

  const previousStatus = order.international_status as InternationalStatus | null
  const orderUpdate: Record<string, unknown> = { international_status: nextStatus }
  const sourcingUpdate: Record<string, unknown> = {}
  let publicNote = ''

  switch (action as InternationalStatusAction) {
    case 'confirm_availability':
      sourcingUpdate.source_status = 'available'
      sourcingUpdate.source_last_verified_at = new Date().toISOString()
      publicNote = 'Confirmamos que la prenda sigue disponible. Ahora la compramos en la plataforma de origen.'
      break
    case 'register_external_purchase':
      sourcingUpdate.source_status = 'purchased'
      if (typeof payload.external_order_reference === 'string') sourcingUpdate.external_order_reference = payload.external_order_reference
      if (typeof payload.external_purchase_price === 'number') sourcingUpdate.external_purchase_price = payload.external_purchase_price
      if (typeof payload.external_purchase_currency === 'string') sourcingUpdate.external_purchase_currency = payload.external_purchase_currency
      if (typeof payload.external_purchase_date === 'string') sourcingUpdate.external_purchase_date = payload.external_purchase_date
      publicNote = 'Compramos tu prenda en la plataforma de origen.'
      break
    case 'mark_received_spain':
      publicNote = 'Tu prenda llegó a nuestro centro logístico en Europa.'
      break
    case 'mark_in_transit':
      publicNote = 'Tu prenda ya va en tránsito hacia Chile.'
      break
    case 'mark_customs':
      publicNote = 'Tu prenda está en trámite aduanero.'
      break
    case 'mark_received_chile':
      publicNote = 'Tu prenda ya llegó a Chile. La estamos revisando.'
      break
    case 'approve_quality_check':
      publicNote = 'Revisamos tu prenda y está lista para despacharse.'
      break
    case 'prepare_national_shipping':
      publicNote = 'Estamos preparando el despacho dentro de Chile.'
      break
    case 'mark_delivered':
      publicNote = 'Confirmamos la entrega de tu prenda.'
      break
    case 'mark_unavailable':
      sourcingUpdate.source_status = 'unavailable'
      publicNote = 'La prenda ya no estaba disponible en la plataforma de origen — anulamos tu compra.'
      break
    case 'start_cancellation':
      publicNote = 'Iniciamos la cancelación de tu compra.'
      break
    case 'begin_refund':
      publicNote = 'Iniciamos el reembolso de tu compra.'
      break
    case 'confirm_refund':
      publicNote = 'Confirmamos tu reembolso.'
      break
  }

  if (Object.keys(sourcingUpdate).length > 0) {
    sourcingUpdate.updated_at = new Date().toISOString()
    await admin.from('listing_sourcing').update(sourcingUpdate).eq('listing_id', order.listing_id)
  }

  // Espejo de conveniencia en listing_sourcing para poder filtrar/columnear
  // sin joinear orders — la fuente de verdad sigue siendo orders + el historial.
  await admin.from('listing_sourcing').update({ international_product_status: nextStatus }).eq('listing_id', order.listing_id)

  if (action === 'confirm_refund') {
    orderUpdate.status = 'cancelled'
  }

  const { error: orderErr } = await admin.from('orders').update(orderUpdate).eq('id', orderId)
  if (orderErr) return Response.json({ error: orderErr.message }, { status: 500 })

  const internalNote = typeof payload.internal_note === 'string' ? payload.internal_note : null
  await recordHistory(nextStatus, previousStatus, publicNote, internalNote)

  // "Producto agotado en origen" también inicia el flujo de cancelación de
  // inmediato (sección 9 del encargo) — evita un segundo clic manual.
  if (action === 'mark_unavailable') {
    const cancellationStatus = nextInternationalStatus('start_cancellation', nextStatus)
    await admin.from('orders').update({ international_status: cancellationStatus }).eq('id', orderId)
    await admin.from('listing_sourcing').update({ international_product_status: cancellationStatus }).eq('listing_id', order.listing_id)
    await recordHistory(cancellationStatus, nextStatus, 'Iniciamos la cancelación de tu compra.', null)
  }

  // Notificaciones a la clienta — nunca incluyen internal_note ni datos de origen.
  if (buyer?.email) {
    switch (action as InternationalStatusAction) {
      case 'confirm_availability':
        await sendInternationalAvailabilityConfirmedEmail({ to: buyer.email, name: buyer.name, listingTitle })
        break
      case 'mark_unavailable':
        await sendInternationalUnavailableCancelledEmail({ to: buyer.email, name: buyer.name, listingTitle })
        break
      case 'register_external_purchase':
        await sendInternationalPurchasedEmail({ to: buyer.email, name: buyer.name, listingTitle })
        break
      case 'mark_received_spain':
        await sendInternationalTransitUpdateEmail({ to: buyer.email, name: buyer.name, listingTitle, stage: 'received_at_foreign_hub' })
        break
      case 'mark_in_transit':
        await sendInternationalTransitUpdateEmail({ to: buyer.email, name: buyer.name, listingTitle, stage: 'international_transit' })
        break
      case 'mark_received_chile':
        await sendInternationalReceivedInChileEmail({ to: buyer.email, name: buyer.name, listingTitle })
        break
      case 'begin_refund':
        await sendInternationalRefundInitiatedEmail({ to: buyer.email, name: buyer.name, listingTitle })
        break
      case 'confirm_refund':
        await sendInternationalRefundCompletedEmail({ to: buyer.email, name: buyer.name, listingTitle, amount: order.amount })
        break
    }
  }

  return Response.json({ ok: true, status: action === 'mark_unavailable' ? 'cancellation_pending' : nextStatus })
}
