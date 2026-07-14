// Filtro de contacto/pago externo para el chat comprador-vendedora.
//
// Esto es detección por patrones (regex), no un modelo de IA — igual que la
// primera línea de defensa real que usan marketplaces como Vinted. Atrapa los
// intentos más comunes (teléfono, email, @usuario, dirección, transferencia)
// pero no detecta evasión creativa (números deletreados con palabras, texto
// con espaciado raro para despistar el regex, etc.). Eso requeriría un
// clasificador de texto entrenado — no está implementado acá.

interface ModerationResult {
  blocked: boolean
  reason?: string
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
const HANDLE_RE = /(^|\s)@[a-zA-Z0-9_.]{3,}/
// Teléfono chileno (+56 9 1234 5678) o cualquier corrida de 7+ dígitos seguidos
// (sin espaciarlos de más, para no confundir con precios "1.234.567").
const PHONE_RE = /\b(?:\+?56[\s.-]?)?9[\s.-]?\d{4}[\s.-]?\d{4}\b|\b\d{7,}\b/
// RUT chileno (12.345.678-9) — se puede usar para pedir una transferencia.
const RUT_RE = /\b\d{1,2}\.?\d{3}\.?\d{3}[-‐]\s?[\dkK]\b/
const ADDRESS_RE = /\b(calle|avenida|av\.|pasaje|psje\.?|depto\.?|departamento|block|población|poblacion|villa)\b/i
const PAYMENT_RE = /\b(whatsapp|whats\s?app|instagram|insta|transferencia|transferir|webpay|dep[oó]sito|efectivo|paypal|zelle|mercadopago fuera|fuera de (la )?plataforma|fuera de bdress)\b/i

export function moderateMessage(content: string): ModerationResult {
  if (EMAIL_RE.test(content)) {
    return { blocked: true, reason: 'Contiene un correo electrónico' }
  }
  if (HANDLE_RE.test(content)) {
    return { blocked: true, reason: 'Contiene un usuario de red social (@...)' }
  }
  if (RUT_RE.test(content)) {
    return { blocked: true, reason: 'Contiene un RUT' }
  }
  if (PHONE_RE.test(content)) {
    return { blocked: true, reason: 'Contiene un número de teléfono' }
  }
  if (ADDRESS_RE.test(content)) {
    return { blocked: true, reason: 'Contiene una dirección' }
  }
  if (PAYMENT_RE.test(content)) {
    return { blocked: true, reason: 'Menciona un medio de pago o contacto fuera de Bdress' }
  }
  return { blocked: false }
}

export const MODERATION_MESSAGE =
  'No podés compartir teléfonos, correos, direcciones ni medios de pago externos por chat. ' +
  'La dirección se entrega en el checkout y el pago se procesa por Mercado Pago — así tu compra queda protegida. ' +
  'Los intentos repetidos pueden hacer que se suspenda tu cuenta.'

// A partir de la 3ª vez, el aviso a la propia usuaria se pone más directo —
// además del correo que le llega al equipo para revisar el caso.
export const REPEAT_OFFENDER_THRESHOLD = 3

export function repeatOffenderMessage(count: number): string {
  return (
    `Este es tu intento número ${count} de compartir contacto o pago fuera de Bdress. ` +
    'Si vuelve a pasar, tu cuenta puede ser suspendida.'
  )
}
