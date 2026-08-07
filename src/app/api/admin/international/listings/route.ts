import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateHouseSellerId } from '@/lib/international/house-seller'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Crea un listing "Internacional por encargo" a nombre del perfil de sistema
// Bdress Internacional. A diferencia de ListingForm.tsx (insert directo del
// cliente, protegido por la policy seller_id = auth.uid()), esto pasa por un
// endpoint admin con el cliente service-role — la vendedora de estos
// listings nunca es la admin autenticada, así que esa policy no aplicaría.
export async function POST(request: Request) {
  const user = await checkAdmin()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const requiredStrings = ['title', 'category', 'size', 'brand', 'condition']
  for (const field of requiredStrings) {
    if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
      return Response.json({ error: `Falta el campo "${field}"` }, { status: 400 })
    }
  }
  if (typeof body.price !== 'number' || body.price <= 0) {
    return Response.json({ error: 'El precio final debe ser mayor a 0' }, { status: 400 })
  }
  if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(p => typeof p === 'string')) {
    return Response.json({ error: 'Agrega al menos una fotografía' }, { status: 400 })
  }
  if (body.content_authorization_confirmed !== true) {
    return Response.json({ error: 'Debes confirmar la autorización de uso de fotos y contenido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const houseSellerId = await getOrCreateHouseSellerId()

  const { data: listing, error: listingErr } = await admin
    .from('listings')
    .insert({
      seller_id: houseSellerId,
      title: body.title,
      description: typeof body.description === 'string' ? body.description : '',
      category: body.category,
      subcategory: '',
      size: body.size,
      brand: body.brand,
      condition: body.condition,
      colors: Array.isArray(body.colors) ? body.colors : [],
      shipping_size: typeof body.shipping_size === 'string' ? body.shipping_size : 'mediano',
      price: body.price,
      photos: body.photos,
      status: 'active',
      product_category: typeof body.product_category === 'string' ? body.product_category : null,
      product_type: typeof body.product_type === 'string' ? body.product_type : null,
      source_type: 'international_on_demand',
      international_lead_time_min_days: typeof body.international_lead_time_min_days === 'number' ? body.international_lead_time_min_days : 20,
      international_lead_time_max_days: typeof body.international_lead_time_max_days === 'number' ? body.international_lead_time_max_days : 30,
      international_shipping_notes: typeof body.international_shipping_notes === 'string' ? body.international_shipping_notes : null,
    })
    .select('id')
    .single()

  if (listingErr || !listing) {
    return Response.json({ error: listingErr?.message ?? 'Error creando el listing' }, { status: 500 })
  }

  const { error: sourcingErr } = await admin.from('listing_sourcing').insert({
    listing_id: listing.id,
    source_platform: typeof body.source_platform === 'string' ? body.source_platform : 'manual',
    source_url: typeof body.source_url === 'string' ? body.source_url : null,
    source_listing_id: typeof body.source_listing_id === 'string' ? body.source_listing_id : null,
    source_original_price: typeof body.source_original_price === 'number' ? body.source_original_price : null,
    source_original_currency: typeof body.source_original_currency === 'string' ? body.source_original_currency : null,
    source_status: typeof body.source_status === 'string' ? body.source_status : 'pending_verification',
    source_last_verified_at: new Date().toISOString(),
    international_cost_estimate: typeof body.international_cost_estimate === 'number' ? body.international_cost_estimate : null,
    international_customs_estimate: typeof body.international_customs_estimate === 'number' ? body.international_customs_estimate : null,
    international_internal_notes: typeof body.international_internal_notes === 'string' ? body.international_internal_notes : null,
    external_seller_name: typeof body.external_seller_name === 'string' ? body.external_seller_name : null,
    external_location: typeof body.external_location === 'string' ? body.external_location : null,
    content_authorization_confirmed_by: user.id,
    content_authorization_confirmed_at: new Date().toISOString(),
  })

  if (sourcingErr) {
    // El listing ya se creó — no lo dejamos huérfano de datos administrativos,
    // pero informamos el error para que la admin reintente completar los campos.
    return Response.json({ id: listing.id, warning: `Listing creado, pero falló guardar los datos de origen: ${sourcingErr.message}` }, { status: 207 })
  }

  return Response.json({ id: listing.id })
}
