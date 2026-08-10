import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLabelReadyEmail, sendLabelSentToBuyerEmail } from '@/lib/email'
import { shipDeadline } from '@/lib/catalog'
import { carrierInstructions, carrierLabel, type CarrierId } from '@/lib/shipping/carrierDetection'

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

// Modo manual (MANUAL_LABEL_MODE en catalog.ts — sin credenciales de
// producción de Chilexpress/Starken todavía): la admin genera la etiqueta a
// mano en el Portal Empresas Chilexpress y la sube acá para que le llegue a
// la vendedora por correo, en vez de mandarla ella misma por fuera del
// sitio. `courier`/`trackingNumber` vienen del análisis automático
// (api/admin/orders/[id]/label/analyze) ya confirmado por la admin, o
// ingresados a mano si no se pudo detectar — nunca se inventan acá, son
// obligatorios en el body.
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
    return Response.json({ error: 'Falta el transportista o el número de seguimiento — complétalos antes de enviar' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, seller_id, buyer_id, listing_id, tracking_number, paid_at')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.status !== 'paid') {
    return Response.json({ error: 'Esta orden no está en estado pagado' }, { status: 409 })
  }

  const path = `labels/${order.id}.${ext}`
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
      label_url: publicUrl,
      label_courier: courier,
      label_tracking_number: trackingNumber,
      label_uploaded_at: uploadedAt,
    })
    .eq('id', id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  const [{ data: seller }, { data: buyer }, { data: listing }] = await Promise.all([
    admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
    admin.from('profiles').select('email, name').eq('id', order.buyer_id).single(),
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  const deadline = order.paid_at ? shipDeadline(order.paid_at) : null
  // El transportista puede venir de la detección automática (un CarrierId
  // conocido) o escrito a mano por la admin (texto libre) — en ese segundo
  // caso no hay instrucciones específicas, se usa un texto genérico.
  const normalizedCourier = courier.toLowerCase().replace(/[^a-z0-9]/g, '')
  const knownCarrierId = KNOWN_CARRIER_IDS.find(c => c === normalizedCourier) ?? null
  const instructions = knownCarrierId ? carrierInstructions(knownCarrierId) : `Debes despachar tu paquete a través de ${courier} utilizando la etiqueta adjunta.`
  const displayCarrierLabel = knownCarrierId ? carrierLabel(knownCarrierId) : courier

  if (seller?.email) {
    await sendLabelReadyEmail({
      to: seller.email,
      name: seller.name,
      listingTitle: listing?.title ?? 'tu prenda',
      orderId: id,
      trackingNumber,
      carrierInstructions: instructions,
      deadline,
    })
  }

  if (buyer?.email) {
    await sendLabelSentToBuyerEmail({
      to: buyer.email,
      name: buyer.name,
      listingTitle: listing?.title ?? 'tu prenda',
      carrierLabel: displayCarrierLabel,
      trackingNumber,
      deadline,
    })
  }

  return Response.json({ ok: true, labelUrl: publicUrl, sentTo: seller?.email ?? null })
}
