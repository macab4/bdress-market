// Tarjeta de compartir de una sola prenda (a diferencia de la grilla 2x3 de
// instagramStory/layout.ts) — un único bloque vertical: logo, foto grande,
// datos, pie de página. El pie usa marginTop: 'auto' así que no hace falta
// calcular alturas hacia atrás: nada puede superponerse porque es una sola
// columna de flujo normal. Dos variantes comparten esta misma estructura:
// "story" (9:16, para historias / share sheet nativo) y "post" (4:5, el
// ratio máximo que Instagram acepta en feed/carrusel — un 9:16 ahí se
// recorta feo). PHOTO_HEIGHT en ambas está calculado a mano para dejar
// margen de sobra incluso con un título de 2 líneas (el máximo posible, por
// el line-clamp del template) — ver brand.md del proyecto si se ajusta.
export type ShareCardVariant = 'story' | 'post'

export interface ShareCardLayout {
  CANVAS_WIDTH: number
  CANVAS_HEIGHT: number
  BG_COLOR: string

  MARGIN_X: number
  MARGIN_TOP: number
  MARGIN_BOTTOM: number
  CONTENT_WIDTH: number

  LOGO_WIDTH: number
  LOGO_HEIGHT: number
  GAP_AFTER_LOGO: number

  PHOTO_HEIGHT: number
  PHOTO_BG: string
  GAP_AFTER_PHOTO: number

  BRAND_FONT_SIZE: number
  BRAND_COLOR: string
  BRAND_LETTER_SPACING: string

  TITLE_FONT_SIZE: number
  TITLE_COLOR: string
  TITLE_LINE_HEIGHT: number
  TITLE_MARGIN_TOP: number

  PRICE_FONT_SIZE: number
  PRICE_COLOR: string
  PRICE_MARGIN_TOP: number

  SIZE_FONT_SIZE: number
  SIZE_COLOR: string
  SIZE_MARGIN_TOP: number

  BADGE_FONT_SIZE: number
  BADGE_COLOR: string
  BADGE_BG: string
  BADGE_MARGIN_TOP: number

  FOOTER_FONT_SIZE: number
  FOOTER_COLOR: string
  FOOTER_LETTER_SPACING: string
}

const LOGO_ASPECT = 2172 / 724 // aspecto real de /logo.png

function logoHeight(width: number): number {
  return Math.round(width / LOGO_ASPECT)
}

export const storyLayout: ShareCardLayout = {
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1920,
  BG_COLOR: '#FFFFFF',

  MARGIN_X: 72,
  MARGIN_TOP: 90,
  MARGIN_BOTTOM: 80,
  CONTENT_WIDTH: 1080 - 72 * 2,

  LOGO_WIDTH: 240,
  LOGO_HEIGHT: logoHeight(240),
  GAP_AFTER_LOGO: 56,

  PHOTO_HEIGHT: 1120,
  PHOTO_BG: '#F4F2ED',
  GAP_AFTER_PHOTO: 44,

  BRAND_FONT_SIZE: 30,
  BRAND_COLOR: '#7fab87',
  BRAND_LETTER_SPACING: '3px',

  TITLE_FONT_SIZE: 52,
  TITLE_COLOR: '#1A1A1A',
  TITLE_LINE_HEIGHT: 1.15,
  TITLE_MARGIN_TOP: 10,

  PRICE_FONT_SIZE: 58,
  PRICE_COLOR: '#1A1A1A',
  PRICE_MARGIN_TOP: 24,

  SIZE_FONT_SIZE: 32,
  SIZE_COLOR: '#6B7280',
  SIZE_MARGIN_TOP: 14,

  BADGE_FONT_SIZE: 26,
  BADGE_COLOR: '#5a7a55',
  BADGE_BG: 'rgba(127,171,135,0.14)',
  BADGE_MARGIN_TOP: 28,

  FOOTER_FONT_SIZE: 32,
  FOOTER_COLOR: '#9CA3AF',
  FOOTER_LETTER_SPACING: '3px',
}

// 1080x1350 (4:5) — el ratio más alto que Instagram permite en feed/carrusel
// sin recortar. Mismos tokens visuales que storyLayout, tamaños de texto y
// PHOTO_HEIGHT recalculados para el lienzo más bajo (presupuesto verificado
// a mano con título de 2 líneas: suma ~1239px + pie ~82px, deja ~29px de
// margen — ver comentario de cabecera).
export const postLayout: ShareCardLayout = {
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  BG_COLOR: '#FFFFFF',

  MARGIN_X: 64,
  MARGIN_TOP: 64,
  MARGIN_BOTTOM: 56,
  CONTENT_WIDTH: 1080 - 64 * 2,

  LOGO_WIDTH: 200,
  LOGO_HEIGHT: logoHeight(200),
  GAP_AFTER_LOGO: 40,

  PHOTO_HEIGHT: 800,
  PHOTO_BG: '#F4F2ED',
  GAP_AFTER_PHOTO: 32,

  BRAND_FONT_SIZE: 24,
  BRAND_COLOR: '#7fab87',
  BRAND_LETTER_SPACING: '2.5px',

  TITLE_FONT_SIZE: 38,
  TITLE_COLOR: '#1A1A1A',
  TITLE_LINE_HEIGHT: 1.15,
  TITLE_MARGIN_TOP: 8,

  PRICE_FONT_SIZE: 44,
  PRICE_COLOR: '#1A1A1A',
  PRICE_MARGIN_TOP: 18,

  SIZE_FONT_SIZE: 24,
  SIZE_COLOR: '#6B7280',
  SIZE_MARGIN_TOP: 10,

  BADGE_FONT_SIZE: 20,
  BADGE_COLOR: '#5a7a55',
  BADGE_BG: 'rgba(127,171,135,0.14)',
  BADGE_MARGIN_TOP: 20,

  FOOTER_FONT_SIZE: 22,
  FOOTER_COLOR: '#9CA3AF',
  FOOTER_LETTER_SPACING: '2.5px',
}

export function getShareCardLayout(variant: ShareCardVariant): ShareCardLayout {
  return variant === 'post' ? postLayout : storyLayout
}
