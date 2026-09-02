import type { ImageDisplayMode } from '../instagramStory/imageValidation'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, BG_COLOR, MARGIN_X, MARGIN_TOP, MARGIN_BOTTOM, CONTENT_WIDTH,
  LOGO_WIDTH, LOGO_HEIGHT, GAP_AFTER_LOGO, PHOTO_HEIGHT, PHOTO_BG, GAP_AFTER_PHOTO,
  BRAND_FONT_SIZE, BRAND_COLOR, BRAND_LETTER_SPACING,
  TITLE_FONT_SIZE, TITLE_COLOR, TITLE_LINE_HEIGHT, TITLE_MARGIN_TOP,
  PRICE_FONT_SIZE, PRICE_COLOR, PRICE_MARGIN_TOP,
  SIZE_FONT_SIZE, SIZE_COLOR, SIZE_MARGIN_TOP,
  BADGE_FONT_SIZE, BADGE_COLOR, BADGE_BG, BADGE_MARGIN_TOP,
  FOOTER_FONT_SIZE, FOOTER_COLOR, FOOTER_LETTER_SPACING,
} from './layout'

export interface ShareCardProps {
  title: string
  brand: string | null
  priceLabel: string
  size: string | null // null = no aplica (ej. accesorios), no se muestra
  photo: { dataUri: string; mode: ImageDisplayMode } | null
  logoDataUri: string
  badgeLabel: string | null // null = no es envío internacional, no se muestra
  siteLabel: string
}

// Misma filosofía que instagramStory/template.tsx: 100% flexbox, un solo
// flujo en columna, el pie de página se ancla al fondo con marginTop: 'auto'
// en vez de calcular posiciones — así nada puede quedar superpuesto.
export function buildShareCardElement({ title, brand, priceLabel, size, photo, logoDataUri, badgeLabel, siteLabel }: ShareCardProps) {
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoDataUri} width={LOGO_WIDTH} height={LOGO_HEIGHT} style={{ objectFit: 'contain', alignSelf: 'center' }} alt="" />

      <div
        style={{
          width: CONTENT_WIDTH,
          height: PHOTO_HEIGHT,
          marginTop: GAP_AFTER_LOGO,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 20,
          backgroundColor: PHOTO_BG,
        }}
      >
        {photo && (
          photo.mode === 'contain' ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUri} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.dataUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          )
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', width: CONTENT_WIDTH, marginTop: GAP_AFTER_PHOTO }}>
        {brand && (
          <div
            style={{
              display: 'flex',
              fontSize: BRAND_FONT_SIZE,
              fontWeight: 600,
              color: BRAND_COLOR,
              letterSpacing: BRAND_LETTER_SPACING,
              textTransform: 'uppercase',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {brand}
          </div>
        )}

        <div
          style={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            marginTop: brand ? TITLE_MARGIN_TOP : 0,
            fontFamily: 'Noto Serif',
            fontWeight: 600,
            fontSize: TITLE_FONT_SIZE,
            lineHeight: TITLE_LINE_HEIGHT,
            color: TITLE_COLOR,
          }}
        >
          {title}
        </div>

        <div
          style={{
            display: 'flex',
            marginTop: PRICE_MARGIN_TOP,
            fontSize: PRICE_FONT_SIZE,
            fontWeight: 600,
            color: PRICE_COLOR,
          }}
        >
          {priceLabel}
        </div>

        {size && (
          <div
            style={{
              display: 'flex',
              marginTop: SIZE_MARGIN_TOP,
              fontSize: SIZE_FONT_SIZE,
              fontWeight: 500,
              color: SIZE_COLOR,
            }}
          >
            {`Talla ${size}`}
          </div>
        )}

        {badgeLabel && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              alignSelf: 'flex-start',
              marginTop: BADGE_MARGIN_TOP,
              padding: '16px 26px',
              borderRadius: 999,
              backgroundColor: BADGE_BG,
              fontSize: BADGE_FONT_SIZE,
              fontWeight: 600,
              color: BADGE_COLOR,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            {`🌎 ${badgeLabel}`}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          marginTop: 'auto',
          fontSize: FOOTER_FONT_SIZE,
          fontWeight: 500,
          color: FOOTER_COLOR,
          letterSpacing: FOOTER_LETTER_SPACING,
        }}
      >
        {siteLabel}
      </div>
    </div>
  )
}
