import { createAdminClient } from '@/lib/supabase/admin'

const AUTO_RELEASE_DAYS = 7

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// Libera automáticamente órdenes "shipped" hace más de 7 días sin
// confirmación ni disputa — no mueve plata real, solo marca la orden
// como "completed" (el pago a la vendedora ya sigue siendo manual).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: released, error } = await admin
    .from('orders')
    .update({ status: 'completed' })
    .eq('status', 'shipped')
    .lt('shipped_at', cutoff)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ released: released?.length ?? 0 })
}
