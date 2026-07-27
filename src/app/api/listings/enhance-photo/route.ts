import { createClient } from '@/lib/supabase/server'
import { enhancePhoto, PHOTO_ENHANCE_ACTIONS, PhotoEnhanceAction } from '@/lib/nanoBanana'

// Gemini puede tardar bastante en fotos grandes — sin esto Vercel corta la
// función a los 10s por defecto y el fetch del cliente queda colgado sin
// respuesta clara.
export const maxDuration = 60

const MAX_SIZE = 10 * 1024 * 1024 // 10MB, igual al límite de subida de fotos de prenda

function isValidAction(value: FormDataEntryValue | null): value is PhotoEnhanceAction {
  return typeof value === 'string' && value in PHOTO_ENHANCE_ACTIONS
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('photo')
  const action = formData.get('action')

  if (!(file instanceof File)) return Response.json({ error: 'Falta la foto' }, { status: 400 })
  if (!file.type.startsWith('image/')) return Response.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
  if (file.size > MAX_SIZE) return Response.json({ error: 'La imagen es muy pesada' }, { status: 400 })
  if (!isValidAction(action)) return Response.json({ error: 'Acción no reconocida' }, { status: 400 })

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const enhanced = await enhancePhoto(buffer, file.type, action)
    return new Response(new Uint8Array(enhanced), { headers: { 'Content-Type': 'image/png' } })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Error al mejorar la foto' }, { status: 502 })
  }
}
