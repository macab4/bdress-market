import { ProductGraphicCard } from './ProductGraphicCard'
import type { ImageDisplayMode } from './imageValidation'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, BG_COLOR, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM, CONTENT_WIDTH,
  LOGO_WIDTH, LOGO_HEIGHT, GAP_AFTER_LOGO, TITLE_FONT_SIZE, TITLE_COLOR, TITLE_LETTER_SPACING,
  SUBTITLE_FONT_SIZE, SUBTITLE_COLOR, SUBTITLE_LETTER_SPACING, GAP_TITLE_TO_SUBTITLE, ROW_GAP,
  FOOTER_FONT_SIZE, FOOTER_COLOR, FOOTER_LETTER_SPACING, computeLayout,
} from './layout'

export interface StoryProduct {
  // null/null = tarjeta placeholder de marca (ver ProductGraphicCard.tsx)
  name: string | null
  price: number | null
  photo: { dataUri: string; mode: ImageDisplayMode } | null
  imagePosition?: string
}

export interface BuildStoryOptions {
  products: StoryProduct[] // exactamente 6
  logoDataUri: string
  subtitle?: string // opcional — si no se entrega, el espacio desaparece solo
  siteLabel: string
}

// Composición completa: encabezado (logo + título + bajada opcional), grilla
// 2x3, pie de página. Layout 100% flexbox (Satori no soporta display:grid) y
// sin una sola posición absoluta — cada bloque empuja al siguiente con
// marginTop, así que estructuralmente no pueden superponerse.
export function buildNewArrivalsStoryElement({ products, logoDataUri, subtitle, siteLabel }: BuildStoryOptions) {
  const hasSubtitle = !!subtitle
  const layout = computeLayout(hasSubtitle)
  const rows = [products.slice(0, 2), products.slice(2, 4), products.slice(4, 6)]

  return (
    <div
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: BG_COLOR,
        paddingLeft: MARGIN_X,
        paddingRight: MARGIN_X,
        paddingTop: MARGIN_TOP,
        paddingBottom: MARGIN_BOTTOM,
        fontFamily: 'Assistant',
      }}
    >
      {/* Encabezado */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={LOGO_WIDTH} height={LOGO_HEIGHT} style={{ objectFit: 'contain' }} alt="" />

        <div
          style={{
            display: 'flex',
            marginTop: GAP_AFTER_LOGO,
            fontFamily: 'Noto Serif',
            fontWeight: 600,
            fontSize: TITLE_FONT_SIZE,
            lineHeight: 1.05,
            color: TITLE_COLOR,
            letterSpacing: TITLE_LETTER_SPACING,
            whiteSpace: 'nowrap',
          }}
        >
          ÚLTIMOS INGRESOS
        </div>

        {hasSubtitle && (
          <div
            style={{
              display: 'flex',
              marginTop: GAP_TITLE_TO_SUBTITLE,
              fontFamily: 'Assistant',
              fontWeight: 500,
              fontSize: SUBTITLE_FONT_SIZE,
              lineHeight: 1.1,
              color: SUBTITLE_COLOR,
              letterSpacing: SUBTITLE_LETTER_SPACING,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {/* Grilla 2 columnas x 3 filas */}
      <div style={{ display: 'flex', flexDirection: 'column', width: CONTENT_WIDTH, marginTop: layout.gapAfterHeader }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: i === 0 ? 0 : ROW_GAP,
            }}
          >
            {row.map((product, j) => (
              <ProductGraphicCard
                key={j}
                name={product.name}
                price={product.price}
                imageHeight={layout.imageHeight}
                photo={product.photo}
                imagePosition={product.imagePosition}
                logoDataUri={logoDataUri}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Pie de página */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          marginTop: 'auto',
          fontFamily: 'Assistant',
          fontWeight: 500,
          fontSize: FOOTER_FONT_SIZE,
          color: FOOTER_COLOR,
          letterSpacing: FOOTER_LETTER_SPACING,
        }}
      >
        {siteLabel}
      </div>
    </div>
  )
}
