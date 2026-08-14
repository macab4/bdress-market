import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractPdfText } from '@/lib/shipping/extractPdfText'
import { detectCarrier } from '@/lib/shipping/carrierDetection'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Igual que /label/analyze, pero para una etiqueta que ya está subida (en
// vez de un archivo recién elegido) — sirve para completar
// label_courier/label_tracking_number en órdenes que quedaron sin esos
// datos (ver EditLabelTrackingForm). Solo lee y devuelve lo que detectó, no
// guarda nada — el admin confirma (o corrige) antes de enviar a
// POST /api/admin/orders/[id]/label/tracking.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('label_url')
    .eq('id', id)
    .single()

  if (!order?.label_url) return Response.json({ error: 'Esta orden no tiene una etiqueta subida' }, { status: 409 })

  const fileRes = await fetch(order.label_url).catch(() => null)
  if (!fileRes?.ok) {
    return Response.json({ error: 'No se pudo leer el archivo de la etiqueta' }, { status: 502 })
  }

  const contentType = fileRes.headers.get('content-type') ?? ''
  if (!contentType.includes('pdf') && !order.label_url.toLowerCase().endsWith('.pdf')) {
    return Response.json({ carrier: null, carrierLabel: null, trackingNumber: null, reason: 'not_pdf' })
  }

  const bytes = Buffer.from(await fileRes.arrayBuffer())
  const text = await extractPdfText(bytes)
  if (!text) {
    return Response.json({ carrier: null, carrierLabel: null, trackingNumber: null, reason: 'unreadable_pdf' })
  }

  const result = detectCarrier(text)
  return Response.json(result)
}
