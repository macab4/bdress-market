import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { loadStoryFonts } from '../instagramStory/fonts'
import { pickValidImage } from '../instagramStory/imageValidation'
import { formatStoryPrice } from '../instagramStory/priceFormat'
import { buildShareCardElement } from './template'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './layout'

export interface ShareCardListing {
  title: string
  brand: string | null
  price: number
  photos: string[] | null
  size: string | null
  badgeLabel: string | null // p.ej. "Envío internacional", o null si no aplica
}

// Punto de entrada único, misma forma que instagramStory/index.ts: no arma
// el JSX hasta tener fuentes + logo + foto ya resueltos (nada a medio
// cargar). La foto se reusa tal cual la subió la vendedora — pickValidImage
// solo la redecodifica/reencoda para que Satori pueda dibujarla (mismo
// motivo que en la historia semanal: .webp y JPEGs pesados rompen resvg),
// nunca la reemplaza ni la genera con IA.
export async function generateShareCardPng(listing: ShareCardListing, siteLabel = 'bdressmarket.cl'): Promise<Buffer> {
  const [fonts, logoBuffer, photo] = await Promise.all([
    loadStoryFonts(),
    readFile(join(process.cwd(), 'public/logo.png')),
    pickValidImage(listing.photos),
  ])
  const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`

  const element = buildShareCardElement({
    title: listing.title,
    brand: listing.brand,
    priceLabel: formatStoryPrice(listing.price),
    size: listing.size,
    photo,
    logoDataUri,
    badgeLabel: listing.badgeLabel,
    siteLabel,
  })

  const image = new ImageResponse(element, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, fonts })
  return Buffer.from(await image.arrayBuffer())
}
