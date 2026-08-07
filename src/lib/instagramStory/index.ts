import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { loadStoryFonts } from './fonts'
import { selectStoryProducts } from './selectProducts'
import type { ProductCandidate } from './selectProducts'
import { buildNewArrivalsStoryElement } from './template'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './layout'

export type { ProductCandidate } from './selectProducts'

export interface GenerateStoryOptions {
  candidates: ProductCandidate[]
  subtitle?: string
  siteLabel?: string
}

// Punto de entrada único del generador — encapsula: cargar fuentes (el
// equivalente a esperar document.fonts.ready, pero para Satori: no hay forma
// de invocar ImageResponse sin ya tener los bytes de la fuente en mano),
// validar/seleccionar los 6 productos con imagen válida, armar el JSX, y
// exportar el PNG final. No empieza a "capturar" nada hasta que todos los
// recursos (fuentes, logo, fotos) están resueltos — no existe un estado
// intermedio a medio cargar.
export async function generateNewArrivalsStoryPng({
  candidates, subtitle, siteLabel = 'bdressmarket.cl',
}: GenerateStoryOptions): Promise<Buffer> {
  const [fonts, logoBuffer, products] = await Promise.all([
    loadStoryFonts(),
    readFile(join(process.cwd(), 'public/logo-white.png')),
    selectStoryProducts(candidates),
  ])
  const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`

  const element = buildNewArrivalsStoryElement({ products, logoDataUri, subtitle, siteLabel })
  const image = new ImageResponse(element, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, fonts })
  return Buffer.from(await image.arrayBuffer())
}
