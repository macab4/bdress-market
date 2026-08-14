import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Backfill de transportista/N.º de seguimiento para órdenes que ya tienen
// label_url pero a las que les falta label_courier/label_tracking_number
// (ej. quedaron así por el flujo automático de Starken antes de que
// guardara estos dos campos — ver generate-label/route.ts). No sube ni
// reemplaza el archivo de la etiqueta, solo corrige estos dos datos.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  let courier: string
  let trackingNumber: string
  try {
    const body = await request.json()
    courier = typeof body.courier === 'string' ? body.courier.trim() : ''
    trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.trim() : ''
    if (!courier || !trackingNumber) throw new Error()
  } catch {
    return Response.json({ error: 'Falta el transportista o el número de seguimiento' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, label_url, label_uploaded_at')
    .eq('id', id)
    .single()

  if (!order) return Response.json({ error: 'Orden no encontrada' }, { status: 404 })
  if (!order.label_url) return Response.json({ error: 'Esta orden todavía no tiene una etiqueta subida' }, { status: 409 })

  const { error } = await admin
    .from('orders')
    .update({
      label_courier: courier,
      label_tracking_number: trackingNumber,
      label_uploaded_at: order.label_uploaded_at ?? new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
