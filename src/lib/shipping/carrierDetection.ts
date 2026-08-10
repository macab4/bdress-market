// Detección de transportista + número de seguimiento a partir del texto
// extraído de una etiqueta de envío en PDF (ver
// api/admin/orders/[id]/label/analyze, que usa pdf-parse para obtener este
// texto). Extensible por diseño: agregar un transportista nuevo es agregar
// una entrada a CARRIERS, sin tocar el resto del flujo.
//
// Regla explícita del encargo: si no hay certeza razonable, NUNCA inventar
// un valor — se devuelve null y el admin lo completa a mano antes de poder
// enviar la etiqueta (ver UploadLabelForm.tsx).

export type CarrierId = 'chilexpress' | 'starken' | 'blueexpress'

export interface CarrierConfig {
  id: CarrierId
  label: string
  matches: (text: string) => boolean
  extractTracking: (text: string) => string | null
  sellerInstructions: string
}

const CARRIERS: CarrierConfig[] = [
  {
    id: 'chilexpress',
    label: 'Chilexpress',
    matches: (text) => /\bCHEX\b|CHILEXPRESS/i.test(text),
    // El número de seguimiento (OT) de Chilexpress aparece como una
    // secuencia de 12 dígitos SIN espacios, justo después del código de
    // ruta/sucursal que sí trae espacios (ej. "614 03 03 557 696731298071").
    // Basado en el formato de etiqueta verificado — si Chilexpress cambia el
    // formato, esto puede dejar de matchear, y por diseño cae a "no
    // detectado" en vez de adivinar cualquier otro número de 12 dígitos.
    extractTracking: (text) => {
      const match = text.match(/\b(\d{12})\b/)
      return match ? match[1] : null
    },
    sellerInstructions: 'Debes llevar tu paquete a Chilexpress utilizando la etiqueta adjunta.',
  },
  {
    id: 'starken',
    label: 'Starken',
    // Sin una etiqueta de muestra real todavía — placeholder listo para
    // completar cuando volvamos a operar con Starken (ver MANUAL_LABEL_MODE).
    matches: (text) => /\bSTARKEN\b/i.test(text),
    extractTracking: () => null,
    sellerInstructions: 'Debes llevar tu paquete a una sucursal Starken utilizando la etiqueta adjunta.',
  },
  {
    id: 'blueexpress',
    label: 'Blue Express',
    matches: (text) => /BLUE\s?EXPRESS/i.test(text),
    extractTracking: () => null,
    sellerInstructions: 'Debes coordinar el retiro/despacho con Blue Express utilizando la etiqueta adjunta.',
  },
]

export interface DetectionResult {
  carrier: CarrierId | null
  carrierLabel: string | null
  trackingNumber: string | null
}

export function detectCarrier(text: string): DetectionResult {
  const carrier = CARRIERS.find(c => c.matches(text))
  if (!carrier) return { carrier: null, carrierLabel: null, trackingNumber: null }
  return {
    carrier: carrier.id,
    carrierLabel: carrier.label,
    trackingNumber: carrier.extractTracking(text),
  }
}

export function carrierLabel(id: string): string {
  return CARRIERS.find(c => c.id === id)?.label ?? id
}

export function carrierInstructions(id: string): string {
  return CARRIERS.find(c => c.id === id)?.sellerInstructions ?? 'Sigue las instrucciones de la etiqueta adjunta.'
}
