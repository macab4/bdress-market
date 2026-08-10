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

// ============================================================
// Taxonomía jerárquica (Departamento > Categoría > Tipo de producto).
// Reemplaza, para publicar/editar y para los filtros del catálogo, al
// selector plano de `subcategories` de arriba — ese campo (`subcategory`
// en la base de datos) queda intacto por compatibilidad mientras se
// verifica la migración, pero deja de usarse en la UI nueva.
//
// Niños se representa con el mismo shape de 3 niveles que Mujer/Hombre
// (categoría > tipo): en vez de agregar un cuarto nivel de datos para
// "Niña"/"Niño", esa distinción vive dentro del valor de `product_category`
// (ej. "Niña · Ropa"), así el modelo de datos sigue siendo
// category / product_category / product_type en todos los departamentos.
// ============================================================
export interface TaxonomyType {
  value: string
  label: string
}

export interface TaxonomyProductCategory {
  value: string
  label: string
  types: TaxonomyType[]
}

export interface TaxonomyDepartment {
  value: CategoryValue
  label: string
  productCategories: TaxonomyProductCategory[]
}

function asTypes(labels: string[]): TaxonomyType[] {
  return labels.map(label => ({ value: label, label }))
}

export const TAXONOMY: TaxonomyDepartment[] = [
  {
    value: 'mujer',
    label: 'Mujer',
    productCategories: [
      {
        value: 'ropa', label: 'Ropa',
        types: asTypes(['Vestidos', 'Conjuntos', 'Monos', 'Tops y blusas', 'Faldas', 'Pantalones y jeans', 'Chaquetas y abrigos', 'Túnicas', 'Tejidos', 'Trajes de baño', 'Ropa deportiva', 'Otras prendas']),
      },
      {
        value: 'calzado', label: 'Calzado',
        types: asTypes(['Tacos', 'Sandalias', 'Zapatos planos', 'Botas', 'Zapatillas', 'Otro calzado']),
      },
      {
        value: 'bolsos', label: 'Bolsos',
        types: asTypes(['Clutches', 'Carteras', 'Mini bags', 'Mochilas', 'Otros bolsos']),
      },
      {
        value: 'accesorios', label: 'Accesorios',
        types: asTypes(['Joyas', 'Cinturones', 'Tocados', 'Accesorios para el pelo', 'Chales y capas', 'Anteojos', 'Otros accesorios']),
      },
    ],
  },
  {
    value: 'hombre',
    label: 'Hombre',
    productCategories: [
      {
        value: 'ropa', label: 'Ropa',
        types: asTypes(['Trajes', 'Blazers', 'Camisas', 'Pantalones', 'Chaquetas y abrigos', 'Poleras', 'Otras prendas']),
      },
      {
        value: 'calzado', label: 'Calzado',
        types: asTypes(['Zapatos', 'Zapatillas', 'Botas', 'Otro calzado']),
      },
      {
        value: 'accesorios', label: 'Accesorios',
        types: asTypes(['Corbatas', 'Corbatines', 'Cinturones', 'Pañuelos', 'Otros accesorios']),
      },
    ],
  },
  {
    value: 'ninos',
    label: 'Niños',
    productCategories: [
      { value: 'nina_ropa', label: 'Niña · Ropa', types: asTypes(['Vestidos', 'Conjuntos', 'Abrigos', 'Otras prendas']) },
      { value: 'nina_calzado', label: 'Niña · Calzado', types: asTypes(['Calzado']) },
      { value: 'nina_accesorios', label: 'Niña · Accesorios', types: asTypes(['Accesorios']) },
      { value: 'nino_ropa', label: 'Niño · Ropa', types: asTypes(['Trajes', 'Camisas', 'Pantalones', 'Abrigos', 'Otras prendas']) },
      { value: 'nino_calzado', label: 'Niño · Calzado', types: asTypes(['Calzado']) },
      { value: 'nino_accesorios', label: 'Niño · Accesorios', types: asTypes(['Accesorios']) },
    ],
  },
  {
    value: 'unisex',
    label: 'Unisex',
    productCategories: [
      {
        value: 'ropa', label: 'Ropa',
        types: asTypes(['Poleras y camisetas', 'Buzos y hoodies', 'Pantalones y jeans', 'Chaquetas y abrigos', 'Ropa deportiva', 'Otras prendas']),
      },
      { value: 'calzado', label: 'Calzado', types: asTypes(['Zapatillas', 'Otro calzado']) },
      { value: 'accesorios', label: 'Accesorios', types: asTypes(['Otros accesorios']) },
    ],
  },
]

export function departmentEntry(department: string): TaxonomyDepartment | undefined {
  return TAXONOMY.find(d => d.value === department)
}

export function productCategoryEntry(department: string, productCategory: string): TaxonomyProductCategory | undefined {
  return departmentEntry(department)?.productCategories.find(c => c.value === productCategory)
}

export function productCategoryLabel(department: string, productCategory: string | null): string {
  if (!productCategory) return ''
  return productCategoryEntry(department, productCategory)?.label ?? productCategory
}

// La marca se guarda como texto libre al publicar, así que la misma marca
// puede quedar escrita de formas distintas ("María Cher" / "Maria Cher" /
// "MARIA CHER"). Para navegar por marca (ver listings/[id] y /marcas) hay que
// tratarlas como una sola — se agrupan por esta forma normalizada en vez de
// agregar una tabla de marcas nueva.
export function normalizeBrand(brand: string): string {
  return brand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

export function brandSlug(brand: string): string {
  return normalizeBrand(brand).replace(/\s+/g, '-')
}

// Agrupa una lista de marcas (texto libre) por su forma normalizada. La
// etiqueta visible de cada grupo es la variante de escritura más repetida.
export function groupBrands(rawBrands: (string | null | undefined)[]): { slug: string; label: string; count: number; variants: string[] }[] {
  const groups = new Map<string, Map<string, number>>()
  for (const raw of rawBrands) {
    if (!raw) continue
    const slug = brandSlug(raw)
    if (!groups.has(slug)) groups.set(slug, new Map())
    const variants = groups.get(slug)!
    variants.set(raw, (variants.get(raw) ?? 0) + 1)
  }
  return Array.from(groups.entries()).map(([slug, variants]) => {
    const label = Array.from(variants.entries()).sort((a, b) => b[1] - a[1])[0][0]
    const count = Array.from(variants.values()).reduce((a, b) => a + b, 0)
    return { slug, label, count, variants: Array.from(variants.keys()) }
  })
}

// Resumen legible de una búsqueda guardada, ej. "Mujer · Ropa · Vestidos ·
// Talla M ·  Verde" — usado como label por defecto en /dashboard/saved-searches
// y como texto del botón "Guardar búsqueda".
export function describeSearchParams(params: URLSearchParams): string {
  const parts: string[] = []
  const department = params.get('category')
  const productCategory = params.get('productCategory')
  const productType = params.get('productType')

  if (department) {
    const dept = departmentEntry(department)
    parts.push(dept?.label ?? department)
    if (productCategory) parts.push(productCategoryLabel(department, productCategory))
    if (productType) parts.push(productType)
  }
  if (params.get('q')) parts.push(`"${params.get('q')}"`)
  if (params.get('size')) parts.push(`Talla ${params.get('size')}`)
  if (params.get('brand')) parts.push(params.get('brand')!.split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' '))
  if (params.get('color')) parts.push(params.get('color')!.split(',').join(', '))
  if (params.get('material')) parts.push(params.get('material')!)
  if (params.get('occasion')) parts.push(params.get('occasion')!.split(',')[0])
  if (params.get('length')) parts.push(`Largo ${params.get('length')}`)
  if (params.get('min') || params.get('max')) {
    parts.push(`$${params.get('min') ?? '0'}–$${params.get('max') ?? '∞'}`)
  }

  return parts.length > 0 ? parts.join(' · ') : 'Todas las prendas'
}

// Tallas según la categoría de producto elegida (no el departamento) —
// una cartera no tiene talla, un zapato usa numeración de calzado, y la
// ropa infantil usa rangos etarios sin importar la categoría de producto.
const ROPA_SIZES = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
  '32', '34', '36', '38', '40', '42', '44', '46', '48',
  'Talla única', 'Otra', 'No indica',
]
const SHOE_SIZES = ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', 'Otra']
const NINOS_SIZES = SIZES_BY_CATEGORY.ninos

export function sizeOptionsFor(department: CategoryValue, productCategory: string): string[] {
  if (department === 'ninos') return NINOS_SIZES
  if (productCategory === 'calzado') return SHOE_SIZES
  if (productCategory === 'bolsos') return []
  if (productCategory === 'accesorios') return ['Talla única', 'Otra']
  return ROPA_SIZES
}

// Usado por el filtro de talla del catálogo cuando todavía no se eligió una
// categoría de producto — antes el filtro solo mostraba tallas de letra y
// nunca incluía los rangos etarios de niños ni la numeración de calzado.
export const ALL_SIZES = Array.from(new Set([...ROPA_SIZES, ...SHOE_SIZES, ...NINOS_SIZES]))

// Solo aplica a Vestidos y Faldas — el resto de los tipos de producto no
// lo muestran ni en el formulario ni como filtro.
export const LENGTH_APPLICABLE_TYPES = ['Vestidos', 'Faldas']

export const LENGTHS = ['Mini', 'Midi', 'Largo', 'Asimétrico']

export const OCCASIONS = [
  'Matrimonio de día', 'Matrimonio de noche', 'Fiesta', 'Gala', 'Graduación', 'Civil',
  'Novia', 'Madrina', 'Invitada', 'Cóctel', 'Evento de día', 'Evento de noche',
  'Casual', 'Trabajo', 'Vacaciones', 'Otra',
]

// Usado por el link "Novias y eventos" del menú principal — todas las
// ocasiones de OCCASIONS salvo las claramente casuales/cotidianas.
export const BRIDAL_EVENT_OCCASIONS = OCCASIONS.filter(
  o => !['Casual', 'Trabajo', 'Vacaciones', 'Otra'].includes(o)
)

export const SEASONS = ['Toda temporada', 'Primavera', 'Verano', 'Otoño', 'Invierno']

export const STYLES = [
  'Elegante', 'Formal', 'Romántico', 'Minimalista', 'Clásico', 'Moderno',
  'Sexy', 'Bohemio', 'Casual', 'Vintage', 'Otro',
]

// No se especificó una lista de materiales — esta es una selección
// razonable de materiales comunes en moda; es solo una constante de
// código, fácil de ajustar sin migración.
export const MATERIALS = [
  'Algodón', 'Poliéster', 'Lino', 'Seda', 'Lana', 'Cuero', 'Cuero sintético',
  'Denim', 'Encaje', 'Terciopelo', 'Tul', 'Chiffón', 'Satín', 'Elastano/Lycra', 'Otro',
]

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

// Si nadie dejó reseña a los N días de completada la orden, se manda un
// recordatorio de seguimiento — ver src/app/api/cron/review-followup/route.ts.
export const REVIEW_FOLLOWUP_DAYS = 3

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

// Reserva de pago: si una orden queda pending_payment más de este tiempo sin
// completarse, el cron expire-pending-orders la cancela y libera el listing
// para que otra compradora pueda intentarlo (ver create_or_reuse_pending_order
// en supabase-schema.sql y src/app/api/cron/expire-pending-orders/route.ts).
export const PENDING_ORDER_EXPIRY_MINUTES = 30

// MVP mientras Chilexpress/Starken no entregan credenciales de producción:
// en vez de generar la etiqueta automáticamente, avisamos a ADMIN_EMAIL para
// que la genere a mano en el Portal Empresas y se la envíe a la vendedora.
// La vendedora ingresa ese número de seguimiento con AddTrackingForm.
// Volver a false apenas algún courier entregue credenciales reales.
export const MANUAL_LABEL_MODE = true

// Plazo prometido a la vendedora para despachar tras el pago (ver "Cómo
// vender" y "Envíos" en /terminos, y el correo "¡Vendiste!"). En días
// hábiles; el cron de recordatorio (api/cron/ship-reminder) lo aproxima
// como días corridos para no tener que calcular feriados.
export const SHIP_DEADLINE_BUSINESS_DAYS = 5

// Fecha límite de despacho a partir del pago — misma aproximación (días
// corridos) que usa el cron de recordatorio, para que el admin y los
// correos siempre muestren el mismo número.
export function shipDeadline(paidAt: string): Date {
  return new Date(new Date(paidAt).getTime() + SHIP_DEADLINE_BUSINESS_DAYS * 24 * 60 * 60 * 1000)
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

// Renovar — gratis, mueve la prenda al tope de "Más recientes" actualizando
// bumped_at. Máximo una vez cada BUMP_COOLDOWN_DAYS por prenda para evitar spam.
export const BUMP_COOLDOWN_DAYS = 7

// Destacar — boost pagado vía Mercado Pago que pone la prenda en la fila
// "Destacadas" de la home por BOOST_DURATION_DAYS días (ver featured_until).
export const BOOST_PRICE = 1990
export const BOOST_DURATION_DAYS = 3
