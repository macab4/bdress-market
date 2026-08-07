// Textos centralizados de la modalidad "Envío internacional" (antes
// "Selección internacional"). Alcance v1: constantes en código, igual que
// el resto de src/lib/catalog.ts — un editor de textos en el panel admin
// queda como mejora de segunda etapa.
//
// De cara a la clienta, esto se presenta como un producto disponible con
// envío internacional gestionado por Bdress — sin explicar que la prenda
// se compra después en otra plataforma (Vinted/Depop) ni que su
// disponibilidad se confirma manualmente. Esa operación interna sigue
// existiendo exactamente igual (ver src/lib/international/status.ts y el
// panel admin, que no cambian) — lo único que cambia acá es qué tanto de
// eso se le explica a la clienta.
//
// INTERNATIONAL_TERMS_VERSION identifica qué versión de este texto aceptó
// cada compradora (orders.international_terms_version) — subirla cada vez
// que cambie el contenido del checkbox de aceptación. Subida a v2 porque el
// texto de aceptación cambió de fondo (ya no menciona "confirmación de
// disponibilidad").
export const INTERNATIONAL_TERMS_VERSION = 'v2'

export const INTERNATIONAL_MODE_NAME = 'Envío internacional'
export const INTERNATIONAL_BADGE_LABEL = 'Envío internacional'

export const INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS = 20
export const INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS = 30

export function leadTimeRange(minDays: number | null | undefined, maxDays: number | null | undefined): { min: number; max: number } {
  return {
    min: minDays ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS,
    max: maxDays ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS,
  }
}

export const INTERNATIONAL_AVAILABILITY_MESSAGE =
  'Este producto se encuentra fuera de Chile y cuenta con envío internacional gestionado por Bdress Market.'

export function internationalDeliveryEstimateMessage(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `Entrega estimada: entre ${min} y ${max} días corridos.`
}

export const INTERNATIONAL_HOW_IT_WORKS_TITLE = '¿Cómo funciona el envío internacional?'
export const INTERNATIONAL_HOW_IT_WORKS_STEPS = [
  'Realizas tu compra normalmente en Bdress Market.',
  'Gestionamos el envío internacional de tu pedido.',
  'Una vez que llega a Chile, revisamos la prenda.',
  'Coordinamos el despacho a tu dirección.',
]
export const INTERNATIONAL_HOW_IT_WORKS_CLOSING =
  'Nos encargamos de gestionar todo el proceso para que recibas tu compra directamente en la dirección indicada.'

// El precio publicado por la admin ya contempla el costo aduanero estimado
// (international_customs_estimate) al fijar el precio final — por eso a la
// clienta nunca se le cobra nada aparte al recibir la prenda.
export const INTERNATIONAL_TAXES_INCLUDED_MESSAGE =
  'El precio incluye impuestos y costos de aduana — no vas a pagar nada adicional al recibir tu prenda.'

// Reformulado a propósito sin mencionar por qué podría pasar (Vinted, venta
// en la plataforma de origen, confirmación de disponibilidad, etc.) — solo
// deja constancia de que existe la posibilidad y de que el reembolso es
// completo. Se muestra en el checkout (aceptación) y en los correos
// relevantes; ya no en el modal informativo de la ficha de producto, para
// mantener esa vista simple y no generar dudas antes de la compra.
export const INTERNATIONAL_AVAILABILITY_WARNING =
  'En casos excepcionales podríamos no poder completar tu envío internacional — si eso pasa, anulamos tu compra y te devolvemos el pago completo.'

export const INTERNATIONAL_CHECKOUT_NOTICE_TITLE = 'Tu pedido incluye un producto con envío internacional'

export function internationalCheckoutExplanation(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `Este producto tiene envío internacional gestionado por Bdress Market. Ese proceso toma entre ${min} y ${max} días corridos.`
}

export function internationalConsentText(minDays?: number | null, maxDays?: number | null): string {
  const { min, max } = leadTimeRange(minDays, maxDays)
  return `He leído y acepto que este producto tiene envío internacional gestionado por Bdress Market y que su entrega puede tardar entre ${min} y ${max} días corridos.`
}

export function internationalDelayMessage(): string {
  return 'Tu pedido está tardando más de lo esperado. Nuestro equipo está revisando el envío y te mantendremos informada.'
}

// No hay carrito multi-ítem en la plataforma (cada orden es un solo listing),
// así que hoy nunca existe una compra que mezcle producto nacional e
// internacional en la misma orden. Se centraliza este texto igual, tal como
// pide el encargo, para el día que exista un carrito multi-ítem — no se usa
// en ningún componente todavía.
export const INTERNATIONAL_SEPARATE_SHIPPING_NOTICE =
  'Si tu compra incluye productos nacionales e internacionales, podrían llegar en despachos separados: los productos nacionales suelen despacharse primero, mientras el producto internacional sigue su propio plazo.'
