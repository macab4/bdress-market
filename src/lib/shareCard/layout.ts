// Tarjeta de compartir de una sola prenda (a diferencia de la grilla 2x3 de
// instagramStory/layout.ts) — mismo lienzo 1080x1920 (funciona como story),
// pero un único bloque vertical: logo, foto grande, datos, pie de página. El
// pie usa marginTop: 'auto' así que no hace falta calcular alturas hacia
// atrás como en la grilla: nada puede superponerse porque es una sola
// columna de flujo normal.

export const CANVAS_WIDTH = 1080
export const CANVAS_HEIGHT = 1920
export const BG_COLOR = '#FFFFFF'

export const MARGIN_X = 72
export const MARGIN_TOP = 90
export const MARGIN_BOTTOM = 80
export const CONTENT_WIDTH = CANVAS_WIDTH - MARGIN_X * 2 // 936

export const LOGO_WIDTH = 240
const LOGO_ASPECT = 2172 / 724 // aspecto real de /logo.png
export const LOGO_HEIGHT = Math.round(LOGO_WIDTH / LOGO_ASPECT)
export const GAP_AFTER_LOGO = 56

// Constante (no calculada hacia atrás): con un único pie de página al final
// empujado por marginTop: 'auto', no hay riesgo de superposición sin
// importar cuánto texto haya arriba — ver comentario del encabezado.
export const PHOTO_HEIGHT = 1120
export const PHOTO_BG = '#F4F2ED' // mismo tono que CONTAIN_BG en instagramStory
export const GAP_AFTER_PHOTO = 44

export const BRAND_FONT_SIZE = 30
export const BRAND_COLOR = '#7fab87'
export const BRAND_LETTER_SPACING = '3px'

export const TITLE_FONT_SIZE = 52
export const TITLE_COLOR = '#1A1A1A'
export const TITLE_LINE_HEIGHT = 1.15
export const TITLE_MARGIN_TOP = 10

export const PRICE_FONT_SIZE = 58
export const PRICE_COLOR = '#1A1A1A'
export const PRICE_MARGIN_TOP = 24

export const BADGE_FONT_SIZE = 26
export const BADGE_COLOR = '#5a7a55'
export const BADGE_BG = 'rgba(127,171,135,0.14)'
export const BADGE_MARGIN_TOP = 28

export const FOOTER_FONT_SIZE = 32
export const FOOTER_COLOR = '#9CA3AF'
export const FOOTER_LETTER_SPACING = '3px'
