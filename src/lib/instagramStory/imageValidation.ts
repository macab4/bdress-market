import sharp from 'sharp'

// Esto corre en servidor (cron → route handler), no en un navegador — no hay
// `new Image()`, `onerror` ni `naturalWidth`. El equivalente real es: bajar
// los bytes, decodificarlos de verdad con sharp (si sharp no puede
// decodificarla, ninguna librería de imagen podría) y medir el resultado
// decodificado. Esto además resuelve, de raíz, los dos bugs reales que
// aparecieron probando la v1 en producción: fotos .webp (no soportadas por
// resvg/Satori) y un .jpg de 2.2MB que resvg no lograba decodificar — acá se
// reencodan siempre a JPEG normalizado antes de llegar a Satori.
const MIN_DIMENSION = 300
const DEFAULT_TIMEOUT_MS = 4000
const MAX_SIDE = 960 // suficiente para el área de imagen más grande de la gráfica (~456-912px)

export type ImageDisplayMode = 'cover' | 'contain'

export interface ValidatedImage {
  ok: true
  buffer: Buffer
  width: number
  height: number
}
export interface InvalidImage {
  ok: false
  reason: string
}

// Nombre pedido explícitamente en el encargo. A diferencia de un validador
// de navegador (que solo puede resolver true/false), acá conviene devolver
// también los bytes ya decodificados y normalizados — quien llama los
// necesita para construir la gráfica, así que descartarlos y volver a bajar
// la imagen sería trabajo doble.
export async function loadAndValidateImage(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ValidatedImage | InvalidImage> {
  if (!url) return { ok: false, reason: 'empty_url' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { ok: false, reason: `http_${res.status}` }

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return { ok: false, reason: 'not_an_image' }

    const raw = Buffer.from(await res.arrayBuffer())

    // rotate() sin argumentos respeta la orientación EXIF antes de medir.
    const pipeline = sharp(raw, { failOn: 'error' }).rotate()
    const metadata = await pipeline.metadata()
    const width = metadata.width ?? 0
    const height = metadata.height ?? 0
    if (width < MIN_DIMENSION || height < MIN_DIMENSION) return { ok: false, reason: 'too_small' }

    const normalized = await pipeline
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer()
    const normalizedMeta = await sharp(normalized).metadata()

    return {
      ok: true,
      buffer: normalized,
      width: normalizedMeta.width ?? width,
      height: normalizedMeta.height ?? height,
    }
  } catch (err) {
    // Cubre onerror (decode fallido), abort por timeout, y cualquier error de red.
    return { ok: false, reason: err instanceof Error ? err.message : 'unknown_error' }
  } finally {
    clearTimeout(timer)
  }
}

// Heurística de encuadre (sección "TRATAMIENTO INTELIGENTE DE IMÁGENES"): sin
// un campo manual en la base de datos que distinga "foto editorial" de "foto
// de catálogo con fondo liso", se infiere mirando los cuatro bordes de la
// imagen ya normalizada. Si son mayormente claros/blancos → casi siempre es
// una prenda o accesorio aislado sobre fondo liso → "contain". Si no, es una
// foto de encuadre completo (modelo, styling editorial) → "cover".
async function classifyDisplayMode(buffer: Buffer, width: number, height: number): Promise<ImageDisplayMode> {
  const sampleSize = Math.max(4, Math.round(Math.min(width, height) * 0.06))
  const corners = [
    { left: 0, top: 0 },
    { left: Math.max(0, width - sampleSize), top: 0 },
    { left: 0, top: Math.max(0, height - sampleSize) },
    { left: Math.max(0, width - sampleSize), top: Math.max(0, height - sampleSize) },
  ]

  try {
    const samples = await Promise.all(corners.map(async ({ left, top }) => {
      const { data } = await sharp(buffer)
        .extract({ left, top, width: sampleSize, height: sampleSize })
        .raw()
        .toBuffer({ resolveWithObject: true })
      let sum = 0
      for (const value of data) sum += value
      return sum / data.length
    }))
    const avgBrightness = samples.reduce((a, b) => a + b, 0) / samples.length
    return avgBrightness > 235 ? 'contain' : 'cover'
  } catch {
    // Si la muestra de píxeles falla por lo que sea, "cover" es la opción
    // más segura visualmente (nunca deja franjas de color de fondo grandes).
    return 'cover'
  }
}

export interface ProcessedImage {
  dataUri: string
  mode: ImageDisplayMode
}

// Orden de fallback: prueba cada foto de la prenda en orden hasta encontrar
// una válida. Si ninguna sirve, devuelve null — quien llama pasa al
// siguiente producto candidato (ver selectProducts.ts).
export async function pickValidImage(photos: string[] | null | undefined, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ProcessedImage | null> {
  for (const url of photos ?? []) {
    const result = await loadAndValidateImage(url, timeoutMs)
    if (!result.ok) {
      console.warn(`[instagram-story] imagen descartada (${result.reason}): ${url}`)
      continue
    }
    const mode = await classifyDisplayMode(result.buffer, result.width, result.height)
    return { dataUri: `data:image/jpeg;base64,${result.buffer.toString('base64')}`, mode }
  }
  return null
}
