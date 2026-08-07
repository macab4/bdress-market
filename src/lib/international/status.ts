import { InternationalStatus } from '@/types'

// Carril de estado de la modalidad "Selección internacional" — separado de
// orders.status (pago/fulfillment genérico) tal como pide el encargo. Este
// archivo es la única fuente de verdad de qué estados existen, cómo se ven,
// y qué transición dispara cada acción administrativa.

export const INTERNATIONAL_STATUS_CONFIG: Record<InternationalStatus, { label: string; color: string }> = {
  awaiting_source_verification: { label: 'Validando disponibilidad', color: 'bg-gray-100 text-gray-500' },
  source_confirmed:             { label: 'Disponibilidad confirmada', color: 'bg-blue-50 text-blue-600' },
  source_purchase_pending:      { label: 'Comprando en origen', color: 'bg-blue-50 text-blue-600' },
  source_purchased:             { label: 'Compra internacional realizada', color: 'bg-blue-50 text-blue-600' },
  received_at_foreign_hub:      { label: 'Recibido en centro logístico', color: 'bg-amber-50 text-amber-600' },
  international_transit:        { label: 'En tránsito internacional', color: 'bg-amber-50 text-amber-600' },
  customs_processing:           { label: 'En trámite aduanero', color: 'bg-amber-50 text-amber-600' },
  received_in_chile:            { label: 'Recibido en Chile', color: 'bg-amber-50 text-amber-600' },
  quality_check:                { label: 'En revisión por Bdress', color: 'bg-amber-50 text-amber-600' },
  national_shipping_pending:    { label: 'Preparando despacho', color: 'bg-amber-50 text-amber-600' },
  nationally_shipped:           { label: 'Despachado en Chile', color: 'bg-amber-50 text-amber-600' },
  delivered:                    { label: 'Entregado', color: 'bg-green-50 text-green-700' },
  source_unavailable:           { label: 'Cancelado por falta de disponibilidad', color: 'bg-red-50 text-red-600' },
  cancellation_pending:         { label: 'Cancelado por falta de disponibilidad', color: 'bg-red-50 text-red-600' },
  refund_pending:               { label: 'Reembolso en proceso', color: 'bg-red-50 text-red-600' },
  refunded:                     { label: 'Reembolsado', color: 'bg-gray-100 text-gray-400' },
}

// Camino "feliz" en orden, usado para la línea de tiempo de la clienta
// (src/app/dashboard/purchases). Los estados de cancelación/reembolso no
// forman parte de este camino porque son una rama aparte.
export const INTERNATIONAL_STATUS_FLOW: InternationalStatus[] = [
  'awaiting_source_verification',
  'source_confirmed',
  'source_purchase_pending',
  'source_purchased',
  'received_at_foreign_hub',
  'international_transit',
  'customs_processing',
  'received_in_chile',
  'quality_check',
  'national_shipping_pending',
  'nationally_shipped',
  'delivered',
]

export const INTERNATIONAL_CANCELLATION_FLOW: InternationalStatus[] = [
  'source_unavailable',
  'cancellation_pending',
  'refund_pending',
  'refunded',
]

// Acciones administrativas que cambian international_status (ver
// src/app/api/admin/international/orders/[id]/actions/route.ts). Acciones
// que solo anotan datos (register_cost, register_tracking, add_internal_note,
// add_public_update) no aparecen acá porque no mueven el estado.
export type InternationalStatusAction =
  | 'confirm_availability' | 'register_external_purchase' | 'mark_received_spain' | 'mark_in_transit'
  | 'mark_customs' | 'mark_received_chile' | 'approve_quality_check' | 'prepare_national_shipping'
  | 'mark_nationally_shipped' | 'mark_delivered' | 'mark_unavailable' | 'start_cancellation'
  | 'begin_refund' | 'confirm_refund'

export const ALLOWED_TRANSITIONS: Record<InternationalStatusAction, { from: InternationalStatus[]; to: InternationalStatus }> = {
  confirm_availability:       { from: ['awaiting_source_verification'], to: 'source_confirmed' },
  register_external_purchase: { from: ['source_confirmed', 'source_purchase_pending'], to: 'source_purchased' },
  mark_received_spain:        { from: ['source_purchased'], to: 'received_at_foreign_hub' },
  mark_in_transit:            { from: ['received_at_foreign_hub'], to: 'international_transit' },
  mark_customs:               { from: ['international_transit'], to: 'customs_processing' },
  mark_received_chile:        { from: ['international_transit', 'customs_processing'], to: 'received_in_chile' },
  approve_quality_check:      { from: ['received_in_chile'], to: 'quality_check' },
  prepare_national_shipping:  { from: ['quality_check'], to: 'national_shipping_pending' },
  mark_nationally_shipped:    { from: ['national_shipping_pending'], to: 'nationally_shipped' },
  mark_delivered:             { from: ['nationally_shipped'], to: 'delivered' },
  mark_unavailable:           { from: ['awaiting_source_verification', 'source_confirmed', 'source_purchase_pending'], to: 'source_unavailable' },
  start_cancellation:         { from: ['source_unavailable'], to: 'cancellation_pending' },
  begin_refund:               { from: ['cancellation_pending'], to: 'refund_pending' },
  confirm_refund:             { from: ['refund_pending'], to: 'refunded' },
}

export class InvalidInternationalTransitionError extends Error {
  constructor(action: InternationalStatusAction, current: InternationalStatus | null) {
    super(`No se puede aplicar la acción "${action}" desde el estado "${current ?? 'sin estado'}"`)
    this.name = 'InvalidInternationalTransitionError'
  }
}

// Valida y devuelve el próximo estado para una acción — lanza si la
// transición no es válida desde el estado actual. Única puerta de entrada
// para mover international_status, usada tanto por el endpoint de acciones
// admin como por las rutas de despacho nacional existentes.
export function nextInternationalStatus(action: InternationalStatusAction, current: InternationalStatus | null): InternationalStatus {
  const transition = ALLOWED_TRANSITIONS[action]
  if (!current || !transition.from.includes(current)) {
    throw new InvalidInternationalTransitionError(action, current)
  }
  return transition.to
}

// Solo un puñado de despachos internacionales no van a llegar en el plazo
// máximo estimado — usado por el cron de aviso de retraso y por la vista de
// "Mis compras" para mostrar el mensaje de demora.
export function isPastEstimatedDelivery(paidAt: string | null, maxDays: number | null | undefined, currentStatus: InternationalStatus | null): boolean {
  if (!paidAt || currentStatus === 'delivered' || currentStatus === 'refunded') return false
  const days = maxDays ?? 30
  const deadline = new Date(paidAt).getTime() + days * 24 * 60 * 60 * 1000
  return Date.now() > deadline
}
