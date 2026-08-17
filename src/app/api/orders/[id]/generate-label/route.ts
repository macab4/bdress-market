import { createClient } from '@/lib/supabase/server'
import { createShipment, getShipmentLabel } from '@/lib/starken'
import { sendEmail, emailLayout, sendInternationalNationallyShippedEmail, sendLabelReadyEmail, sendLabelRequestReceivedEmail } from '@/lib/email'
import { MANUAL_LABEL_MODE, shipDeadline } from '@/lib/catalog'
import { carrierInstructions } from '@/lib/shipping/carrierDetection'
import { isAdminEmail } from '@/lib/admin-auth'

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
    .select('id, seller_id, buyer_id, listing_id, status, amount, shipping_name, shipping_phone, shipping_address, shipping_address_extra, shipping_comuna, courier_service_code, international_status, paid_at')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })

  // Productos internacionales: la "vendedora" es el perfil de sistema
  // Bdress Internacional, sin login propio — quien despacha es la admin.
  const isInternational = order.international_status !== null
  const canManage = order.seller_id === user.id || (isInternational && isAdminEmail(user.email))
  if (!canManage) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (order.status !== 'paid') return Response.json({ error: 'La orden no está pagada' }, { status: 409 })
  if (!order.courier_service_code) return Response.json({ error: 'Esta orden no tiene un servicio de envío cotizado' }, { status: 409 })

  // No se puede generar la etiqueta nacional hasta que la prenda esté
  // físicamente en Chile — antes de eso no hay nada que despachar todavía
  // (ver sección 13 del encargo).
  if (isInternational && order.international_status !== 'received_in_chile' && order.international_status !== 'national_shipping_pending') {
    return Response.json({ error: 'La prenda todavía no llega a Chile — no se puede generar el despacho nacional todavía' }, { status: 409 })
  }

  const [{ data: seller }, { data: buyer }, { data: listing }] = await Promise.all([
    supabase.from('profiles').select('name, email, phone, address, comuna').eq('id', order.seller_id).single(),
    supabase.from('profiles').select('name, email').eq('id', order.buyer_id).single(),
    supabase.from('listings').select('title, price, shipping_size').eq('id', order.listing_id).single(),
  ])

  if (!seller?.comuna || !seller.phone || !seller.address) {
    return Response.json({ error: 'Completa tu dirección de despacho en tu perfil antes de generar la etiqueta' }, { status: 409 })
  }
  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })

  // MVP mientras Chilexpress/Starken no entregan credenciales de producción
  // (ver MANUAL_LABEL_MODE en catalog.ts): en vez de llamar a la API del
  // courier, avisamos a la admin para que genere la etiqueta a mano y se la
  // mande a la vendedora, quien luego ingresa el seguimiento con AddTrackingForm.
  if (MANUAL_LABEL_MODE) {
    await supabase.from('orders').update({ label_requested_at: new Date().toISOString() }).eq('id', order.id)

    if (process.env.ADMIN_EMAIL) {
      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Generar etiqueta a mano — ${listing.title}`,
        html: emailLayout('Etiqueta pendiente (modo manual)', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            La vendedora pidió la etiqueta de envío de la orden <strong>${order.id}</strong> (${listing.title},
            valor declarado $${listing.price.toLocaleString('es-CL')}, tamaño <strong>${listing.shipping_size}</strong>).
            Genérala en el Portal Empresas Chilexpress y súbela desde el panel de administración para que le llegue a la vendedora.
          </p>
          <p style="font-size: 13px; color: #666; line-height: 1.6; background: #f7f7f7; padding: 12px 16px;">
            <strong>Retiro (origen)</strong><br/>
            ${seller.name} · ${seller.phone}${seller.email ? ` · ${seller.email}` : ''}<br/>
            ${seller.address}, ${seller.comuna}
          </p>
          <p style="font-size: 13px; color: #666; line-height: 1.6; background: #f7f7f7; padding: 12px 16px;">
            <strong>Entrega (destino)</strong><br/>
            ${order.shipping_name} · ${order.shipping_phone}<br/>
            ${order.shipping_address}${order.shipping_address_extra ? `, ${order.shipping_address_extra}` : ''}, ${order.shipping_comuna}
          </p>
          <p style="text-align: center; margin-top: 24px;">
            <a href="${SITE_URL}/admin/orders/${order.id}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
              Subir etiqueta
            </a>
          </p>
        `),
      })
    }

    // Recordatorio en la campanita — el correo solo no bastaba (se puede
    // perder en el inbox). Solo aplica al camino nacional normal: en el
    // camino internacional quien pide la etiqueta ya es la propia admin
    // (ver canManage arriba), así que no tiene sentido notificarla de algo
    // que ella misma acaba de hacer.
    if (!isInternational && process.env.ADMIN_EMAIL) {
      const { data: adminProfile } = await supabase.from('profiles').select('id').eq('email', process.env.ADMIN_EMAIL).maybeSingle()
      if (adminProfile) {
        await supabase.from('notifications').insert({
          user_id: adminProfile.id, type: 'label_requested', actor_id: order.seller_id, listing_id: order.listing_id,
        })
      }
    }

    if (seller.email) {
      await sendLabelRequestReceivedEmail({ to: seller.email, name: seller.name, listingTitle: listing.title })
    }

    return Response.json({ ok: true, manual: true })
  }

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
    declaredValue: listing.price,
    reference: order.id,
  })

  if ('error' in shipment) {
    return Response.json({ error: shipment.error }, { status: 502 })
  }

  // Subir la etiqueta (PDF) a Storage
  let label_url: string | null = null
  const labelPdf = await getShipmentLabel(shipment.trackingNumber)
  if (labelPdf) {
    const path = `labels/${order.id}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('listings')
      .upload(path, labelPdf, { contentType: 'application/pdf', upsert: true })

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
      label_courier: 'Starken',
      label_tracking_number: shipment.trackingNumber,
      label_uploaded_at: new Date().toISOString(),
      ...(isInternational ? { international_status: 'nationally_shipped' } : {}),
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (isInternational) {
    await supabase.from('order_status_history').insert({
      order_id: id,
      previous_status: order.international_status,
      new_status: 'nationally_shipped',
      changed_by: user.id,
      public_note: 'Tu prenda ya fue despachada dentro de Chile.',
    })
  }

  // Email a la vendedora con la etiqueta para imprimir
  if (seller.email && label_url) {
    await sendLabelReadyEmail({
      to: seller.email,
      name: seller.name,
      listingTitle: listing.title,
      orderId: id,
      trackingNumber: shipment.trackingNumber,
      carrierInstructions: carrierInstructions('starken'),
      deadline: order.paid_at ? shipDeadline(order.paid_at) : null,
    })
  }

  // Email a la compradora avisando que se generó la etiqueta (todavía no significa que Starken ya la retiró)
  if (buyer?.email) {
    if (isInternational) {
      await sendInternationalNationallyShippedEmail({ to: buyer.email, name: buyer.name, listingTitle: listing.title, trackingNumber: shipment.trackingNumber })
    } else {
      await sendEmail({
        to: buyer.email,
        subject: `Tu compra está por ser despachada — ${listing.title}`,
        html: emailLayout('Etiqueta de envío generada', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Hola ${buyer.name ?? ''}, la vendedora generó la etiqueta de envío de <strong>${listing.title}</strong> y la va a despachar en los próximos días.
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
  }

  return Response.json({ ok: true, trackingNumber: shipment.trackingNumber, labelUrl: label_url })
}
