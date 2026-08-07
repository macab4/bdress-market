import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// next/og (Satori) no tiene DOM, así que no existe document.fonts.ready —
// el equivalente exacto es "no llamar a ImageResponse hasta tener los bytes
// de cada fuente ya leídos", que es justo lo que hace este módulo. Solo
// soporta ttf/otf/woff (no woff2) — estos .woff se descargaron una vez de
// Google Fonts (fonts.gstatic.com) y quedan versionados en el repo para no
// depender de red en cada ejecución del cron.
const FONTS_DIR = join(process.cwd(), 'assets/fonts')

export interface StoryFont {
  name: string
  data: Buffer
  weight: 400 | 500 | 600 | 700
  style: 'normal'
}

let cached: StoryFont[] | null = null

export async function loadStoryFonts(): Promise<StoryFont[]> {
  if (cached) return cached

  const [assistantRegular, assistantMedium, assistantSemiBold, notoSerifSemiBold, notoSerifBold] = await Promise.all([
    readFile(join(FONTS_DIR, 'Assistant-Regular.woff')),
    readFile(join(FONTS_DIR, 'Assistant-Medium.woff')),
    readFile(join(FONTS_DIR, 'Assistant-SemiBold.woff')),
    readFile(join(FONTS_DIR, 'NotoSerif-SemiBold.woff')),
    readFile(join(FONTS_DIR, 'NotoSerif-Bold.woff')),
  ])

  cached = [
    { name: 'Assistant', data: assistantRegular, weight: 400, style: 'normal' },
    { name: 'Assistant', data: assistantMedium, weight: 500, style: 'normal' },
    { name: 'Assistant', data: assistantSemiBold, weight: 600, style: 'normal' },
    { name: 'Noto Serif', data: notoSerifSemiBold, weight: 600, style: 'normal' },
    { name: 'Noto Serif', data: notoSerifBold, weight: 700, style: 'normal' },
  ]
  return cached
}
