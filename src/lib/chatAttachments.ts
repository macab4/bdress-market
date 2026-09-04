const SIGNED_URL_EXPIRY_SECONDS = 600

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
export const MAX_ATTACHMENTS_PER_MESSAGE = 5
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
type AllowedMime = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]

const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// No confiamos en file.type (lo manda el cliente) para la validación real —
// se revisan los primeros bytes del archivo. Evita meterle sharp al hot path
// del chat (a diferencia de src/lib/instagramStory/imageValidation.ts, que sí
// reprocesa la imagen porque genera un asset final); acá solo necesitamos
// saber que es una imagen de verdad antes de guardarla.
export function sniffImageMime(bytes: Uint8Array): AllowedMime | null {
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
