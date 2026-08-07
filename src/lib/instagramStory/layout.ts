// Constantes de layout — números derivados de las medidas pedidas, con una
// salvedad importante: pedir 3 filas x 2 columnas de imágenes 4:5 (540-570px
// de alto) MÁS encabezado MÁS pie de página MÁS texto por tarjeta no entra
// matemáticamente en un lienzo de 1920px de alto sin superponerse (sobra por
// ~250-350px). Como el criterio de aceptación #2 ("el título no se
// superpone con las imágenes") es más importante que respetar al pie el
// rango de alto de imagen sugerido, se calculó hacia atrás desde 1920px el
// alto de imagen máximo que sí entra sin overlap con las demás medidas del
// encargo — da ~400-410px (recuadro casi cuadrado en vez de 4:5 estricto).
// Se deja como función en vez de constantes sueltas para que sea explícito
// que es un cálculo, no un número inventado.

export const CANVAS_WIDTH = 1080
export const CANVAS_HEIGHT = 1920
export const BG_COLOR = '#050505'

export const MARGIN_X = 72
export const MARGIN_TOP = 90
export const MARGIN_BOTTOM = 80
export const CONTENT_WIDTH = CANVAS_WIDTH - MARGIN_X * 2 // 936
export const COLUMN_GAP = 24
export const CARD_WIDTH = Math.round((CONTENT_WIDTH - COLUMN_GAP) / 2) // 456

export const LOGO_WIDTH = 180
const LOGO_ASPECT = 280 / 93 // mismo aspecto que /logo-white.png en la home
export const LOGO_HEIGHT = Math.round(LOGO_WIDTH / LOGO_ASPECT)
export const GAP_AFTER_LOGO = 48

export const TITLE_FONT_SIZE = 54
export const TITLE_COLOR = '#F6F3EE'
export const TITLE_LETTER_SPACING = '1.5px'
const TITLE_LINE_HEIGHT = Math.round(TITLE_FONT_SIZE * 1.05)

export const SUBTITLE_FONT_SIZE = 28
export const SUBTITLE_COLOR = '#7DAA89'
export const SUBTITLE_LETTER_SPACING = '3px'
const SUBTITLE_LINE_HEIGHT = Math.round(SUBTITLE_FONT_SIZE * 1.1)
export const GAP_TITLE_TO_SUBTITLE = 14
export const GAP_AFTER_HEADER_WITH_SUBTITLE = 46
export const GAP_AFTER_HEADER_NO_SUBTITLE = 52

export const ROW_GAP = 36
export const PRODUCT_NAME_FONT_SIZE = 21
export const PRODUCT_NAME_COLOR = '#F5F5F3'
export const PRODUCT_NAME_LETTER_SPACING = '0.6px'
export const PRODUCT_NAME_MARGIN_TOP = 14
export const PRODUCT_NAME_LINE_HEIGHT = Math.round(PRODUCT_NAME_FONT_SIZE * 1.15)

export const PRICE_FONT_SIZE = 23
export const PRICE_COLOR = '#7DAA89'
export const PRICE_MARGIN_TOP = 3
export const PRICE_LINE_HEIGHT = Math.round(PRICE_FONT_SIZE * 1.15)

export const FOOTER_GAP = 50
export const FOOTER_FONT_SIZE = 26
export const FOOTER_COLOR = '#F6F3EE'
export const FOOTER_LETTER_SPACING = '2px'
const FOOTER_LINE_HEIGHT = Math.round(FOOTER_FONT_SIZE * 1.1)

export const CONTAIN_BG = '#F4F2ED'
export const CONTAIN_PADDING = 24

export interface StoryLayout {
  headerHeight: number
  gapAfterHeader: number
  imageHeight: number
  cardTextHeight: number
  footerHeight: number
}

// Se calcula desde 1920px hacia atrás (ver comentario del encabezado del
// archivo) — el layout JSX (template.tsx) NO recalcula ni resta nada, solo
// usa gapAfterHeader e imageHeight tal cual: el resto de las alturas salen
// del flujo normal de flexbox (cada bloque empuja al siguiente).
export function computeLayout(hasSubtitle: boolean): StoryLayout {
  const gapAfterHeader = hasSubtitle ? GAP_AFTER_HEADER_WITH_SUBTITLE : GAP_AFTER_HEADER_NO_SUBTITLE
  const headerHeight = hasSubtitle
    ? LOGO_HEIGHT + GAP_AFTER_LOGO + TITLE_LINE_HEIGHT + GAP_TITLE_TO_SUBTITLE + SUBTITLE_LINE_HEIGHT + gapAfterHeader
    : LOGO_HEIGHT + GAP_AFTER_LOGO + TITLE_LINE_HEIGHT + gapAfterHeader

  const cardTextHeight = PRODUCT_NAME_MARGIN_TOP + PRODUCT_NAME_LINE_HEIGHT + PRICE_MARGIN_TOP + PRICE_LINE_HEIGHT
  const footerHeight = FOOTER_GAP + FOOTER_LINE_HEIGHT

  const availableForGrid = CANVAS_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - headerHeight - footerHeight
  const gridRows = 3
  const imageHeight = Math.floor((availableForGrid - gridRows * cardTextHeight - (gridRows - 1) * ROW_GAP) / gridRows)

  return { headerHeight, gapAfterHeader, imageHeight, cardTextHeight, footerHeight }
}
