import {
  CARD_WIDTH, CONTAIN_BG, CONTAIN_PADDING,
  PRODUCT_NAME_FONT_SIZE, PRODUCT_NAME_COLOR, PRODUCT_NAME_LETTER_SPACING, PRODUCT_NAME_MARGIN_TOP, PRODUCT_NAME_LINE_HEIGHT,
  PRICE_FONT_SIZE, PRICE_COLOR, PRICE_MARGIN_TOP, PRICE_LINE_HEIGHT,
} from './layout'
import { formatStoryPrice } from './priceFormat'
import type { ImageDisplayMode } from './imageValidation'

export interface ProductGraphicCardProps {
  // null = tarjeta placeholder de marca sin producto real detrás (solo
  // cuando, tras revisar todos los candidatos, no alcanzan 6 con imagen
  // válida) — mantiene el mismo alto que las demás tarjetas.
  name: string | null
  price: number | null
  imageHeight: number
  // Foto ya validada/normalizada (data URI) + su modo de encuadre — ver
  // imageValidation.ts. Si es null, se dibuja el placeholder de marca en vez
  // de una imagen (nunca un rectángulo negro vacío).
  photo: { dataUri: string; mode: ImageDisplayMode } | null
  // Permite configurar el encuadre en modo "cover" por producto (sección
  // "TRATAMIENTO INTELIGENTE DE IMÁGENES") — sin un campo así en la base de
  // datos hoy, el valor por defecto cubre el caso general.
  imagePosition?: string
  logoDataUri: string
}

export function ProductGraphicCard({ name, price, imageHeight, photo, imagePosition = 'center center', logoDataUri }: ProductGraphicCardProps) {
  return (
    <div style={{ width: CARD_WIDTH, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          width: CARD_WIDTH,
          height: imageHeight,
          display: 'flex',
          overflow: 'hidden',
          backgroundColor: photo?.mode === 'contain' ? CONTAIN_BG : '#111111',
        }}
      >
        {photo ? (
          photo.mode === 'contain' ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: CONTAIN_PADDING,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.dataUri} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.dataUri}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: imagePosition }}
              alt=""
            />
          )
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: CONTAIN_BG,
              gap: 12,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDataUri} width={80} height={27} style={{ objectFit: 'contain', opacity: 0.6 }} alt="" />
            <div style={{ display: 'flex', fontSize: 16, color: '#8A8A85' }}>Imagen no disponible</div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          width: '100%',
          height: PRODUCT_NAME_LINE_HEIGHT,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginTop: PRODUCT_NAME_MARGIN_TOP,
          fontSize: PRODUCT_NAME_FONT_SIZE,
          fontWeight: 600,
          color: PRODUCT_NAME_COLOR,
          letterSpacing: PRODUCT_NAME_LETTER_SPACING,
          textTransform: 'uppercase',
          textAlign: 'left',
        }}
      >
        {name ?? ''}
      </div>
      <div
        style={{
          display: 'flex',
          height: PRICE_LINE_HEIGHT,
          marginTop: PRICE_MARGIN_TOP,
          fontSize: PRICE_FONT_SIZE,
          fontWeight: 600,
          color: PRICE_COLOR,
          textAlign: 'left',
        }}
      >
        {price != null ? formatStoryPrice(price) : ''}
      </div>
    </div>
  )
}
