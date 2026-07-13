export const CATEGORIES = [
  {
    value: 'mujer',
    label: 'Mujer',
    subcategories: [
      'Vestidos de noche',
      'Vestidos de fiesta',
      'Vestidos casuales',
      'Vestidos de novia',
      'Vestidos largos',
      'Vestidos cortos',
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
] as const

export type CategoryValue = (typeof CATEGORIES)[number]['value']

export const SIZES_BY_CATEGORY: Record<CategoryValue, string[]> = {
  mujer: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla única'],
  hombre: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla única'],
  ninos: [
    '0-3 meses', '3-6 meses', '6-12 meses',
    '1-2 años', '2-4 años', '4-6 años', '6-8 años', '8-10 años', '10-12 años', '12-14 años',
  ],
}

export const CONDITIONS = [
  {
    value: 'nuevo_con_etiquetas',
    label: 'Nuevo con etiquetas',
    description: 'Artículo sin estrenar que todavía tiene las etiquetas o está en su embalaje original.',
    color: 'bg-[#8DA988] text-white',
  },
  {
    value: 'nuevo_sin_etiquetas',
    label: 'Nuevo sin etiquetas',
    description: 'Artículo sin estrenar que no tiene las etiquetas o el embalaje original.',
    color: 'bg-[#8DA988] text-white',
  },
  {
    value: 'muy_bueno',
    label: 'Muy bueno',
    description: 'Artículo poco usado que puede tener algún defecto menor. Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-200 text-gray-700',
  },
  {
    value: 'bueno',
    label: 'Bueno',
    description: 'Artículo usado que puede tener defectos o estar desgastado. Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-100 text-gray-600',
  },
  {
    value: 'satisfactorio',
    label: 'Satisfactorio',
    description: 'Artículo bastante usado con defectos o desgaste. Recuerda incluir fotos y descripciones de los desperfectos en el anuncio.',
    color: 'bg-gray-100 text-gray-500',
  },
] as const

export type ConditionValue = (typeof CONDITIONS)[number]['value']

export function conditionLabel(value: string): string {
  return CONDITIONS.find(c => c.value === value)?.label ?? value
}

export const SHIPPING_SIZES = [
  { value: 'pequeno', label: 'Pequeño', description: 'Para artículos que quepan en un sobre grande.' },
  { value: 'mediano', label: 'Mediano', description: 'Para artículos que quepan en una caja de zapatos.', recommended: true },
  { value: 'grande', label: 'Grande', description: 'Para artículos que quepan en una caja de mudanza.' },
] as const

export type ShippingSizeValue = (typeof SHIPPING_SIZES)[number]['value']

export const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pago pendiente', color: 'bg-gray-100 text-gray-500' },
  paid:            { label: 'Pagado',         color: 'bg-blue-50 text-blue-600' },
  shipped:         { label: 'En camino',      color: 'bg-amber-50 text-amber-600' },
  delivered:       { label: 'Entregado',      color: 'bg-green-50 text-green-700' },
  completed:       { label: 'Completado',     color: 'bg-[#8DA988]/10 text-[#5a7a55]' },
  disputed:        { label: 'En disputa',     color: 'bg-red-50 text-red-600' },
  cancelled:       { label: 'Cancelado',      color: 'bg-gray-100 text-gray-400' },
}
