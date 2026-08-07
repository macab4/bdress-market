// Textos centralizados de la modalidad "Selección internacional" (sección 19
// del encargo: nombre comercial, plazos, mensajes de disponibilidad/checkout,
// texto de aceptación, política de no-disponibilidad, aviso de retraso,
// texto de despacho separado). Alcance v1: constantes en código, igual que el
// resto de src/lib/catalog.ts — un editor de textos en el panel admin queda
// como mejora de segunda etapa.
//
// INTERNATIONAL_TERMS_VERSION identifica qué versión de este texto aceptó
// cada compradora (orders.international_terms_version) — subirla cada vez
// que cambie el contenido del checkbox de aceptación.
export const INTERNATIONAL_TERMS_VERSION = 'v1'

export const INTERNATIONAL_MODE_NAME = 'Selección internacional'
export const INTERNATIONAL_BADGE_LABEL = 'Internacional por encargo'

export const INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS = 20
export const INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS = 30

export function leadTimeRange(minDays: number | null | undefined, maxDays: number | null | undefined): { min: number; max: number } {
  return {
    min: minDays ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS,
    max: maxDays ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS,
  }
}

export const INTERNATIONAL_AVAILABILITY_MESSAGE =
  'Este producto se encuentra disponible por encargo internacional. Después de tu compra confirmaremos su disponibilidad con la plataforma de origen.'

export function internationalDeliveryEstimateMessage(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `Entrega estimada: entre ${min} y ${max} días corridos desde la confirmación de disponibilidad.`
}

export const INTERNATIONAL_HOW_IT_WORKS_TITLE = '¿Cómo funciona el encargo internacional?'
export const INTERNATIONAL_HOW_IT_WORKS_STEPS = [
  'Realizas la compra en Bdress Market.',
  'Confirmamos que la prenda continúe disponible.',
  'Compramos la prenda en la plataforma internacional.',
  'La recibimos y trasladamos a Chile.',
  'Revisamos la prenda y coordinamos el despacho a tu dirección.',
]

export const INTERNATIONAL_AVAILABILITY_WARNING =
  'Como se trata de una publicación externa y de una pieza generalmente única, existe la posibilidad de que se venda antes de que podamos confirmar la compra. En ese caso anularemos la orden y gestionaremos la devolución completa del pago.'

export const INTERNATIONAL_CHECKOUT_NOTICE_TITLE = 'Tu pedido incluye un producto internacional por encargo'

export function internationalCheckoutExplanation(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `Antes de despacharlo, confirmamos manualmente que la prenda siga disponible en la plataforma de origen y la compramos a tu nombre. Ese proceso, sumado al traslado a Chile, toma entre ${min} y ${max} días corridos. Si la prenda ya no está disponible, anulamos tu compra y te devolvemos el pago completo.`
}

export function internationalConsentText(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `He leído y acepto que este producto se compra por encargo internacional, que su disponibilidad debe ser confirmada y que su entrega puede tardar entre ${min} y ${max} días corridos desde la confirmación.`
}

export const INTERNATIONAL_UNAVAILABLE_POLICY =
  'Si la prenda ya no está disponible en la plataforma de origen antes de comprarla, anulamos tu orden por completo y te devolvemos el pago íntegro — no se cobra ninguna penalización.'

export function internationalDelayMessage(): string {
  return 'Tu pedido está tardando más de lo esperado. Nuestro equipo está revisando el traslado y te mantendremos informada.'
}

// No hay carrito multi-ítem en la plataforma (cada orden es un solo listing),
// así que hoy nunca existe una compra que mezcle producto nacional e
// internacional en la misma orden. Se centraliza este texto igual, tal como
// pide el encargo, para el día que exista un carrito multi-ítem — no se usa
// en ningún componente todavía.
export const INTERNATIONAL_SEPARATE_SHIPPING_NOTICE =
  'Si tu compra incluye productos nacionales e internacionales, podrían llegar en despachos separados: los productos nacionales suelen despacharse primero, mientras el producto internacional sigue su propio plazo.'
