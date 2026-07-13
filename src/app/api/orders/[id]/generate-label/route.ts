import { createClient } from '@/lib/supabase/server'
import { createShipment } from '@/lib/chilexpress'
import { sendEmail, emailLayout } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const { data: order } = await supabase
    .from('orders')
    .select('id, seller_id, buyer_id, listing_id, status, amount, shipping_name, shipping_phone, shipping_address, shipping_address_extra, shipping_comuna, courier_service_code')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (order.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está pagada' }, { status: 409 })
  if (!order.courier_service_code) return Response.json({ error: 'Esta orden no tiene un servicio de envío cotizado' }, { status: 409 })

  const [{ data: seller }, { data: buyer }, { data: listing }] = await Promise.all([
    supabase.from('profiles').select('name, email, phone, address, comuna').eq('id', order.seller_id).single(),
    supabase.from('profiles').select('name, email').eq('id', order.buyer_id).single(),
    supabase.from('listings').select('title, price, shipping_size').eq('id', order.listing_id).single(),
  ])

  if (!seller?.comuna || !seller.phone || !seller.address) {
    return Response.json({ error: 'Completa tu dirección de despacho en tu perfil antes de generar la etiqueta' }, { status: 409 })
  }
  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })

  const shipment = await createShipment({
    originComuna: seller.comuna,
    originStreetName: seller.address,
    destComuna: order.shipping_comuna,
    destStreetName: order.shipping_address,
    destStreetNumber: '',
    destSupplement: order.shipping_address_extra,
    senderName: seller.name,
    senderPhone: seller.phone,
    senderEmail: seller.email,
    recipientName: order.shipping_name,
    recipientPhone: order.shipping_phone,
    recipientEmail: buyer?.email ?? seller.email,
    size: listing.shipping_size,
    serviceCode: order.courier_service_code,
    declaredValue: listing.price,
    reference: order.id,
  })

  if ('error' in shipment) {
    return Response.json({ error: shipment.error }, { status: 502 })
  }

  // Subir la etiqueta (imagen JPEG en base64) a Storage
  let label_url: string | null = null
  if (shipment.labelBase64) {
    const buffer = Buffer.from(shipment.labelBase64, 'base64')
    const path = `labels/${order.id}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('listings')
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
      label_url = publicUrl
    }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      tracking_number: shipment.trackingNumber,
      courier_tracking_number: shipment.trackingNumber,
      courier_barcode: shipment.barcode,
      label_url,
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Email a la vendedora con la etiqueta para imprimir
  if (seller.email && label_url) {
    await sendEmail({
      to: seller.email,
      subject: `Tu etiqueta de envío está lista — ${listing.title}`,
      html: emailLayout('Etiqueta lista', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${seller.name}, generamos la etiqueta de envío para <strong>${listing.title}</strong>.
        </p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Número de seguimiento: <strong style="font-family: monospace;">${shipment.trackingNumber}</strong>
        </p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${label_url}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Descargar etiqueta
          </a>
        </p>
        <p style="font-size: 13px; color: #888; line-height: 1.6;">
          Imprimila, pegala en el paquete, y llevalo a cualquier sucursal de Chilexpress.
        </p>
      `),
    })
  }

  // Email a la compradora avisando el despacho
  if (buyer?.email) {
    await sendEmail({
      to: buyer.email,
      subject: `Tu prenda va en camino — ${listing.title}`,
      html: emailLayout('Prenda despachada', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${buyer.name ?? ''}, tu compra <strong>${listing.title}</strong> ya fue despachada.
        </p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Número de seguimiento: <strong style="font-family: monospace;">${shipment.trackingNumber}</strong>
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Ver mi compra
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true, trackingNumber: shipment.trackingNumber, labelUrl: label_url })
}
