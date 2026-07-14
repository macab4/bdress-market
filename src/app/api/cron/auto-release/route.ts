import { createAdminClient } from '@/lib/supabase/admin'
import { CONFIRMED_HOLD_DAYS, SHIPPED_FALLBACK_DAYS } from '@/lib/catalog'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// No mueve plata real, solo marca la orden como "completed" (el pago a
// la vendedora ya sigue siendo manual).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const confirmedCutoff = new Date(Date.now() - CONFIRMED_HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const shippedCutoff = new Date(Date.now() - SHIPPED_FALLBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [confirmedResult, shippedResult] = await Promise.all([
    admin
      .from('orders')
      .update({ status: 'completed' })
      .eq('status', 'delivered')
      .lt('confirmed_at', confirmedCutoff)
      .select('id'),
    admin
      .from('orders')
      .update({ status: 'completed' })
      .eq('status', 'shipped')
      .lt('shipped_at', shippedCutoff)
      .select('id'),
  ])

  if (confirmedResult.error) return Response.json({ error: confirmedResult.error.message }, { status: 500 })
  if (shippedResult.error) return Response.json({ error: shippedResult.error.message }, { status: 500 })

  return Response.json({
    released: (confirmedResult.data?.length ?? 0) + (shippedResult.data?.length ?? 0),
    fromConfirmedHold: confirmedResult.data?.length ?? 0,
    fromShippedFallback: shippedResult.data?.length ?? 0,
  })
}
