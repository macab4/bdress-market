export const CATEGORIES = [
  {
    value: 'mujer',
    label: 'Mujer',
    subcategories: [
      'Vestidos mini',
      'Vestidos midi',
      'Vestidos largos',
      'Vestidos de novia',
      'Vestidos de fiesta',
      'Vestidos de verano',
      'Vestidos de invierno',
      'Vestidos formales',
      'Vestidos informales',
      'Otros vestidos',
      'Conjuntos',
      'Tops y blusas',
      'Pantalones y jeans',
      'Faldas',
      'Chaquetas y abrigos',
      'Ropa deportiva',
      'Trajes de baño',
      'Zapatos',
      'Bolsos y accesorios',
    ],
  },
  {
    value: 'hombre',
    label: 'Hombre',
    subcategories: [
      'Camisas',
      'Poleras y camisetas',
      'Conjuntos',
      'Pantalones y jeans',
      'Trajes y chaquetas de vestir',
      'Chaquetas y abrigos',
      'Ropa deportiva',
      'Zapatos',
      'Accesorios',
    ],
  },
  {
    value: 'ninos',
    label: 'Niños',
    subcategories: [
      'Ropa bebé (0-2 años)',
      'Ropa niña (2-14 años)',
      'Ropa niño (2-14 años)',
      'Zapatos',
      'Accesorios',
    ],
  },
  {
    value: 'unisex',
    label: 'Unisex',
    subcategories: [
      'Poleras y camisetas',
      'Buzos y hoodies',
      'Pantalones y jeans',
      'Chaquetas y abrigos',
      'Ropa deportiva',
      'Zapatillas',
      'Accesorios',
    ],
  },
] as const

export type CategoryValue = (typeof CATEGORIES)[number]['value']

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL', 'Talla única', 'Otros']

export const SIZES_BY_CATEGORY: Record<CategoryValue, string[]> = {
  mujer: LETTER_SIZES,
  hombre: LETTER_SIZES,
  ninos: [
    '0-3 meses', '3-6 meses', '6-12 meses',
    '1-2 años', '2-4 años', '4-6 años', '6-8 años', '8-10 años', '10-12 años', '12-14 años',
    'Otros',
  ],
  unisex: LETTER_SIZES,
}

export const CONDITIONS = [
  {
    value: 'nuevo_con_etiquetas',
    label: 'Nuevo con etiquetas',
    description: 'Artículo sin estrenar que todavía tiene las etiquetas o está en su embalaje original.',
    color: 'bg-[#7fab87] text-white',
  },
  {
    value: 'nuevo_sin_etiquetas',
    label: 'Nuevo sin etiquetas',
    description: 'Artículo sin estrenar que no tiene las etiquetas o el embalaje original.',
    color: 'bg-[#7fab87] text-white',
  },
  {
    value: 'muy_bueno',
    label: 'Muy bueno',
    description: 'Artículo poco usado que puede tener algún defecto menor.',
    sellerHint: 'Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-200 text-gray-700',
  },
  {
    value: 'bueno',
    label: 'Bueno',
    description: 'Artículo usado que puede tener defectos o estar desgastado.',
    sellerHint: 'Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-100 text-gray-600',
  },
  {
    value: 'satisfactorio',
    label: 'Satisfactorio',
    description: 'Artículo bastante usado con defectos o desgaste.',
    sellerHint: 'Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-100 text-gray-500',
  },
] as const

export type ConditionValue = (typeof CONDITIONS)[number]['value']

export function conditionLabel(value: string): string {
  return CONDITIONS.find(c => c.value === value)?.label ?? value
}

// "Bueno" vs "Muy bueno" es un matiz demasiado subjetivo para decidir una compra
// de un vistazo — lo que de verdad orienta a la compradora es si es nuevo o usado.
// Por eso el listado y las tarjetas solo muestran este grupo; el detalle fino
// de CONDITIONS queda como matiz secundario dentro de la página de producto.
export const CONDITION_GROUPS = [
  { value: 'nuevo', label: 'Nuevo', conditions: ['nuevo_con_etiquetas', 'nuevo_sin_etiquetas'], color: 'bg-[#7fab87] text-white' },
  { value: 'usado', label: 'Usado', conditions: ['muy_bueno', 'bueno', 'satisfactorio'], color: 'bg-gray-100 text-gray-600' },
] as const

export type ConditionGroupValue = (typeof CONDITION_GROUPS)[number]['value']

export function conditionGroup(value: string): ConditionGroupValue {
  return CONDITION_GROUPS.find(g => (g.conditions as readonly string[]).includes(value))?.value ?? 'usado'
}

export function conditionGroupLabel(value: string): string {
  return CONDITION_GROUPS.find(g => g.value === conditionGroup(value))!.label
}

export function conditionGroupColor(value: string): string {
  return CONDITION_GROUPS.find(g => g.value === conditionGroup(value))!.color
}

// Paleta estilo Vinted: la vendedora elige un color al publicar y la
// compradora filtra por él en el listado.
export const COLORS = [
  { value: 'negro', label: 'Negro', hex: '#000000' },
  { value: 'gris', label: 'Gris', hex: '#9CA3AF' },
  { value: 'blanco', label: 'Blanco', hex: '#FFFFFF' },
  { value: 'crema', label: 'Crema', hex: '#F5F0DC' },
  { value: 'beige', label: 'Beige', hex: '#E8D3B0' },
  { value: 'naranja_pastel', label: 'Naranja pastel', hex: '#F7C99B' },
  { value: 'naranja', label: 'Naranja', hex: '#F5A623' },
  { value: 'coral', label: 'Coral', hex: '#E8734A' },
  { value: 'rojo', label: 'Rojo', hex: '#C0392B' },
  { value: 'burdeos', label: 'Burdeos', hex: '#7B241C' },
  { value: 'rosa', label: 'Rosa', hex: '#E91E8C' },
  { value: 'rosa_palido', label: 'Rosa pálido', hex: '#F4C2C2' },
  { value: 'morado', label: 'Morado', hex: '#6C2C8C' },
  { value: 'lila', label: 'Lila', hex: '#C9A0DC' },
  { value: 'azul_claro', label: 'Azul claro', hex: '#A8D5F2' },
  { value: 'azul', label: 'Azul', hex: '#2166B8' },
  { value: 'azul_marino', label: 'Azul marino', hex: '#1B2A5B' },
  { value: 'turquesa', label: 'Turquesa', hex: '#5FBCB9' },
  { value: 'menta', label: 'Menta', hex: '#A8E6CE' },
  { value: 'verde', label: 'Verde', hex: '#4C9A4A' },
  { value: 'verde_oscuro', label: 'Verde oscuro', hex: '#2E5A34' },
  { value: 'caqui', label: 'Caqui', hex: '#8A8B5C' },
  { value: 'marron', label: 'Marrón', hex: '#6B3F22' },
  { value: 'amarillo', label: 'Amarillo', hex: '#F5E050' },
  { value: 'plateado', label: 'Plateado', hex: '#C7C7C7' },
  { value: 'dorado', label: 'Dorado', hex: '#D4AF37' },
  { value: 'varios', label: 'Varios', hex: 'multi' },
  { value: 'transparente', label: 'Transparente', hex: 'transparent' },
] as const

export type ColorValue = (typeof COLORS)[number]['value']

export const MAX_LISTING_COLORS = 2

export function colorLabel(value: string | null): string {
  if (!value) return 'Sin color'
  return COLORS.find(c => c.value === value)?.label ?? value
}

export function colorLabels(values: string[] | null | undefined): string {
  if (!values || values.length === 0) return 'Sin color'
  return values.map(colorLabel).join(', ')
}

export function colorHex(value: string): string {
  return COLORS.find(c => c.value === value)?.hex ?? '#E5E7EB'
}

export const SHIPPING_SIZES = [
  { value: 'pequeno', label: 'Pequeño', description: 'Para artículos que quepan en un sobre grande.' },
  { value: 'mediano', label: 'Mediano', description: 'Para artículos que quepan en una caja de zapatos.', recommended: true },
  { value: 'grande', label: 'Grande', description: 'Para artículos que quepan en una caja de mudanza.' },
] as const

export type ShippingSizeValue = (typeof SHIPPING_SIZES)[number]['value']

// Plazo de reclamo tras confirmar recepción — igual al usado por el cron
// de auto-liberación en src/app/api/cron/auto-release/route.ts.
export const CONFIRMED_HOLD_DAYS = 2

// Respaldo para compradoras que nunca confirman ni abren una disputa,
// contado desde el despacho.
export const SHIPPED_FALLBACK_DAYS = 7

export function daysUntilRelease(confirmedAt: string | null): string {
  if (!confirmedAt) return `${CONFIRMED_HOLD_DAYS} días`
  const releaseAt = new Date(confirmedAt).getTime() + CONFIRMED_HOLD_DAYS * 24 * 60 * 60 * 1000
  const hoursLeft = Math.ceil((releaseAt - Date.now()) / (60 * 60 * 1000))
  if (hoursLeft <= 0) return 'menos de un día'
  if (hoursLeft <= 24) return '1 día'
  return `${Math.ceil(hoursLeft / 24)} días`
}

// Señal de frescura en la ficha de producto ("Publicado hace X").
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`
  const years = Math.floor(months / 12)
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`
}

// Protección BDress — se suma al precio de la prenda y la paga la compradora.
// Publicar y vender es gratis: a la vendedora no se le descuenta comisión.
export const COMMISSION_PCT = 0.10

export function buyerProtectionFee(price: number): number {
  return Math.round(price * COMMISSION_PCT)
}

// Costo de procesamiento del pago (no es una comisión de Bdress) — se descuenta
// del monto que recibe la vendedora, igual que cobra cualquier pasarela de pago.
export const PROCESSING_FEE_PCT = 0.035
export const PROCESSING_FEE_FIXED = 490

export function paymentProcessingFee(price: number): number {
  return Math.round(price * PROCESSING_FEE_PCT) + PROCESSING_FEE_FIXED
}

// Sistema de ofertas — negociación de precio entre compradora y vendedora.
// No se puede ofertar menos de este % del precio publicado.
export const OFFER_MIN_PCT = 0.5
// Rondas máximas por hilo (oferta inicial cuenta como ronda 1) antes de que
// solo queden aceptar/rechazar como opciones, para evitar loops infinitos.
export const OFFER_MAX_ROUNDS = 3
// Tiempo que tiene la otra parte para responder antes de que la oferta expire.
export const OFFER_EXPIRY_HOURS = 48
// Tiempo que tiene la compradora para pagar al precio pactado antes de que
// la oferta aceptada expire y ya no sea válida.
export const OFFER_ACCEPTED_HOLD_HOURS = 48
// Descuentos de un clic al hacer una oferta (estilo Vinted) — siempre están
// muy por encima de OFFER_MIN_PCT, así que no necesitan validación aparte.
export const OFFER_PRESET_DISCOUNTS = [0.05, 0.10]

export function minOfferPrice(originalPrice: number): number {
  return Math.ceil(originalPrice * OFFER_MIN_PCT)
}

export const OFFER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pendiente',    color: 'bg-amber-50 text-amber-600' },
  accepted:  { label: 'Aceptada',     color: 'bg-[#7fab87]/10 text-[#5a7a55]' },
  rejected:  { label: 'Rechazada',    color: 'bg-red-50 text-red-600' },
  countered: { label: 'Contraoferta', color: 'bg-blue-50 text-blue-600' },
  expired:   { label: 'Expirada',     color: 'bg-gray-100 text-gray-400' },
  cancelled: { label: 'Cancelada',    color: 'bg-gray-100 text-gray-400' },
}

export function sellerPayout(price: number): number {
  return price - paymentProcessingFee(price)
}

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pago pendiente', color: 'bg-gray-100 text-gray-500' },
  paid:            { label: 'Pagado',         color: 'bg-blue-50 text-blue-600' },
  shipped:         { label: 'En camino',      color: 'bg-amber-50 text-amber-600' },
  delivered:       { label: 'Entregado',      color: 'bg-green-50 text-green-700' },
  completed:       { label: 'Completado',     color: 'bg-[#7fab87]/10 text-[#5a7a55]' },
  disputed:        { label: 'En disputa',     color: 'bg-red-50 text-red-600' },
  cancelled:       { label: 'Cancelado',      color: 'bg-gray-100 text-gray-400' },
}
