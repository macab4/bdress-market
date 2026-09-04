const SIGNED_URL_EXPIRY_SECONDS = 600

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
export const MAX_ATTACHMENTS_PER_MESSAGE = 5
export const MAX_VIDEOS_PER_MESSAGE = 1
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
// Videos cortos del estado real de la prenda (manchas, descosidos, etc.) —
// mp4 es lo que exporta WhatsApp/Android, quicktime es el .mov nativo de
// iPhone cuando no se reencapsula a mp4 antes de compartirlo.
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'] as const
export const ALLOWED_ATTACHMENT_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, ...ALLOWED_VIDEO_MIME_TYPES] as const
type AllowedMime = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

export function isVideoMime(mime: string): boolean {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mime)
}

const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

// No confiamos en file.type (lo manda el cliente) para la validación real —
// se revisan los primeros bytes del archivo. Evita meterle sharp/ffmpeg al
// hot path del chat (a diferencia de src/lib/instagramStory/imageValidation.ts,
// que sí reprocesa la imagen porque genera un asset final); acá solo
// necesitamos saber que el archivo es del tipo que dice ser antes de guardarlo.
export function sniffAttachmentMime(bytes: Uint8Array, declaredMime?: string): AllowedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  // mp4/mov (formato ISO base media): un box de tamaño de 4 bytes seguido
  // del código de 4 caracteres "ftyp" — no distingue mp4 de mov por los
  // bytes (ambos son cajas ISOBMFF), así que se confía en el mime declarado
  // por el navegador para elegir entre los dos una vez confirmada la firma.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return declaredMime === 'video/quicktime' ? 'video/quicktime' : 'video/mp4'
  }
  return null
}

export function extensionForMime(mime: AllowedMime): string {
  return EXTENSION_BY_MIME[mime]
}

// Path armado para que la policy de Storage pueda verificar pertenencia
// leyendo segmentos del path (storage.foldername) sin un join caro: el
// listing_id (o "bundle/<id>" a futuro) va primero, después quién la subió.
export function buildAttachmentPath(listingId: string, senderId: string, mime: AllowedMime): string {
  return `${listingId}/${senderId}/${crypto.randomUUID()}.${extensionForMime(mime)}`
}

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (paths: string[], expiresIn: number) => Promise<{
        data: { path: string | null; signedUrl: string | null }[] | null
        error: { message: string } | null
      }>
    }
  }
}

// Tolerante a que el bucket todavía no exista en prod (migración no corrida
// aún) — degrada mostrando el chat sin fotos en vez de romper la página,
// mismo criterio que el resto de las queries nuevas de este proyecto.
export async function getSignedAttachmentUrls(supabase: StorageClient, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  try {
    const { data, error } = await supabase.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECONDS)
    if (error) {
      console.error('Error al firmar URLs de adjuntos del chat:', error.message)
      return {}
    }
    const map: Record<string, string> = {}
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) map[row.path] = row.signedUrl
    }
    return map
  } catch (err) {
    console.error('Error al firmar URLs de adjuntos del chat:', err)
    return {}
  }
}
