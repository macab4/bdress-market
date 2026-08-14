import { createClient } from '@/lib/supabase/server'
import { extractLabelInfo, toSupportedMediaType } from '@/lib/shipping/extractLabelInfo'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Solo lee el archivo y devuelve lo que detectó — no guarda nada en la orden
// ni manda ningún correo. El admin confirma (o corrige a mano) antes de
// llamar a POST /api/admin/orders/[id]/label, que es el que sí envía.
export async function POST(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Falta el archivo de la etiqueta' }, { status: 400 })
  }

  const mediaType = toSupportedMediaType(file.type)
  if (!mediaType) {
    return Response.json({ carrier: null, carrierLabel: null, trackingNumber: null, reason: 'unsupported_type' })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const result = await extractLabelInfo(bytes, mediaType)
  return Response.json(result)
}
