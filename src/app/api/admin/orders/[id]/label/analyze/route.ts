import { createClient } from '@/lib/supabase/server'
import { extractPdfText } from '@/lib/shipping/extractPdfText'
import { detectCarrier } from '@/lib/shipping/carrierDetection'

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

  // Solo un PDF trae texto real que se pueda leer — una imagen (PNG/JPG)
  // requeriría OCR, que a propósito no está implementado (mejor no detectar
  // nada que arriesgarse a inventar mal un transportista o un número).
  if (file.type !== 'application/pdf') {
    return Response.json({ carrier: null, carrierLabel: null, trackingNumber: null, reason: 'not_pdf' })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const text = await extractPdfText(bytes)
  if (!text) {
    return Response.json({ carrier: null, carrierLabel: null, trackingNumber: null, reason: 'unreadable_pdf' })
  }

  const result = detectCarrier(text)
  return Response.json(result)
}
