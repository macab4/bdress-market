import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

const LISTING_FIELDS = [
  'title', 'description', 'category', 'size', 'brand', 'condition', 'colors', 'shipping_size', 'price',
  'photos', 'product_category', 'product_type', 'status',
  'international_lead_time_min_days', 'international_lead_time_max_days', 'international_shipping_notes',
] as const

const SOURCING_FIELDS = [
  'source_platform', 'source_url', 'source_listing_id', 'source_original_price', 'source_original_currency',
  'source_status', 'international_cost_estimate', 'international_customs_estimate', 'international_internal_notes',
  'external_seller_name', 'external_location', 'external_purchase_price', 'external_purchase_currency',
  'external_purchase_date', 'external_order_reference', 'external_tracking_number', 'external_tracking_url',
] as const

// PATCH edita un listing internacional existente y/o registra el resultado
// de la acción "Comprobar disponibilidad" (sección 2 del encargo: en esta
// versión no consulta Vinted, solo registra lo que la admin confirmó a mano).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // "Comprobar disponibilidad" — acción rápida e independiente de la edición
  // de campos: sigue disponible / ya no disponible / revisar más tarde.
  if (typeof body.availability_check === 'string') {
    const mapping: Record<string, string> = { available: 'available', unavailable: 'unavailable', later: 'pending_verification' }
    const sourceStatus = mapping[body.availability_check]
    if (!sourceStatus) return Response.json({ error: 'availability_check inválido' }, { status: 400 })

    const { error } = await admin
      .from('listing_sourcing')
      .update({ source_status: sourceStatus, source_last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('listing_id', id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  const listingUpdate: Record<string, unknown> = {}
  for (const field of LISTING_FIELDS) {
    if (body[field] !== undefined) listingUpdate[field] = body[field]
  }
  const sourcingUpdate: Record<string, unknown> = {}
  for (const field of SOURCING_FIELDS) {
    if (body[field] !== undefined) sourcingUpdate[field] = body[field]
  }

  if (Object.keys(listingUpdate).length === 0 && Object.keys(sourcingUpdate).length === 0) {
    return Response.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  if (Object.keys(listingUpdate).length > 0) {
    const { error } = await admin.from('listings').update(listingUpdate).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  if (Object.keys(sourcingUpdate).length > 0) {
    sourcingUpdate.updated_at = new Date().toISOString()
    const { error } = await admin.from('listing_sourcing').update(sourcingUpdate).eq('listing_id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
