import { createAdminClient } from '@/lib/supabase/admin'
import { PENDING_ORDER_EXPIRY_MINUTES } from '@/lib/catalog'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). La liberación
// real de una reserva abandonada ya ocurre de forma atómica y perezosa
// dentro de create_or_reuse_pending_order (supabase-schema.sql) la próxima
// vez que alguien intenta comprar esa prenda — este cron es solo limpieza
// periódica para que las órdenes pending_payment abandonadas no queden
// dando vueltas indefinidamente en reportes/paneles.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('status', 'pending_payment')
    .lt('created_at', cutoff)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ expired: data?.length ?? 0 })
}
