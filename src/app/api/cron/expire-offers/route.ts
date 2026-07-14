import { createAdminClient } from '@/lib/supabase/admin'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json).
// Vence ofertas pendientes sin respuesta y ofertas aceptadas cuya compradora
// nunca completó el pago dentro del plazo pactado.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  const [pendingResult, acceptedResult] = await Promise.all([
    admin.from('offers').update({ status: 'expired' }).eq('status', 'pending').lt('expires_at', now).select('id'),
    admin.from('offers').update({ status: 'expired' }).eq('status', 'accepted').lt('accepted_expires_at', now).select('id'),
  ])

  if (pendingResult.error) return Response.json({ error: pendingResult.error.message }, { status: 500 })
  if (acceptedResult.error) return Response.json({ error: acceptedResult.error.message }, { status: 500 })

  return Response.json({
    expired: (pendingResult.data?.length ?? 0) + (acceptedResult.data?.length ?? 0),
    fromPending: pendingResult.data?.length ?? 0,
    fromAcceptedHold: acceptedResult.data?.length ?? 0,
  })
}
