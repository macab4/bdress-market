import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendReturnLabelReadyEmail } from '@/lib/email'
import { carrierInstructions, type CarrierId } from '@/lib/shipping/carrierDetection'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

const KNOWN_CARRIER_IDS: CarrierId[] = ['chilexpress', 'starken', 'blueexpress']

// Mismo proceso manual que la etiqueta de ida (admin/orders/[id]/label) —
// la admin la genera a mano en el portal del courier con las direcciones
// invertidas (retiro en casa de la compradora, entrega en casa de la
// vendedora) y la sube acá. Bdress cubre este envío — no se le cobra a
// nadie (ver comentario de la migración 20260818000000).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const courierRaw = formData?.get('courier')
  const trackingNumberRaw = formData?.get('trackingNumber')

  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Falta el archivo de la etiqueta' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json({ error: 'Formato no soportado — sube un PDF, PNG o JPG' }, { status: 400 })
  }
  const courier = typeof courierRaw === 'string' ? courierRaw.trim() : ''
  const trackingNumber = typeof trackingNumberRaw === 'string' ? trackingNumberRaw.trim() : ''
  if (!courier || !trackingNumber) {
    return Response.json({ error: 'Falta el transportista o el número de seguimiento' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_id, listing_id')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.status !== 'return_pending') {
    return Response.json({ error: 'Esta orden no tiene una devolución en curso' }, { status: 409 })
  }

  const path = `labels/${order.id}-return.${ext}`
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage
    .from('listings')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('listings').getPublicUrl(path)
  const uploadedAt = new Date().toISOString()

  const { error: updateError } = await admin
    .from('orders')
    .update({
      return_label_url: publicUrl,
      return_label_courier: courier,
      return_label_tracking_number: trackingNumber,
      return_label_uploaded_at: uploadedAt,
    })
    .eq('id', id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  const [{ data: buyer }, { data: listing }] = await Promise.all([
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  const normalizedCourier = courier.toLowerCase().replace(/[^a-z0-9]/g, '')
  const knownCarrierId = KNOWN_CARRIER_IDS.find(c => c === normalizedCourier) ?? null
  const instructions = knownCarrierId
    ? carrierInstructions(knownCarrierId)
    : `Debes despachar el paquete de devolución a través de ${courier} utilizando la etiqueta adjunta.`

  if (buyer?.email) {
    await sendReturnLabelReadyEmail({
      to: buyer.email, name: buyer.name, listingTitle: listing?.title ?? 'tu compra',
      labelUrl: publicUrl, trackingNumber, carrierInstructions: instructions,
    })
  }

  return Response.json({ ok: true, labelUrl: publicUrl, sentTo: buyer?.email ?? null })
}
