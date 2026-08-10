import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendLabelReadyEmail } from '@/lib/email'

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

// Modo manual (MANUAL_LABEL_MODE en catalog.ts — sin credenciales de
// producción de Chilexpress/Starken todavía): la admin genera la etiqueta a
// mano en el Portal Empresas Chilexpress y la sube acá para que le llegue a
// la vendedora por correo, en vez de mandarla ella misma por fuera del
// sitio. Reutiliza el mismo bucket/ruta y el mismo correo
// (sendLabelReadyEmail) que ya usa el flujo automático.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!file || !(file instanceof File)) {
    return Response.json({ error: 'Falta el archivo de la etiqueta' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json({ error: 'Formato no soportado — sube un PDF, PNG o JPG' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, seller_id, listing_id, tracking_number')
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

  const { error: updateError } = await admin
    .from('orders')
    .update({ label_url: publicUrl })
    .eq('id', id)

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  const [{ data: seller }, { data: listing }] = await Promise.all([
    admin.from('profiles').select('email, name').eq('id', order.seller_id).single(),
    admin.from('listings').select('title').eq('id', order.listing_id).single(),
  ])

  if (seller?.email) {
    await sendLabelReadyEmail({
      to: seller.email,
      name: seller.name,
      listingTitle: listing?.title ?? 'tu prenda',
      labelUrl: publicUrl,
      trackingNumber: order.tracking_number,
    })
  }

  return Response.json({ ok: true, labelUrl: publicUrl, sentTo: seller?.email ?? null })
}
