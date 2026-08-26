import { createClient } from '@/lib/supabase/server'
import { sendCommissionFreeCampaignEmail } from '@/lib/email'

async function checkAuthorized(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Envía el correo de reactivación "0% comisión" a la lista de destinatarios
// dada. Sin selección automática de audiencia todavía: se pasa explícitamente
// `to` (pensado para probar antes de definir el segmento real a enviar).
export async function POST(request: Request) {
  if (!(await checkAuthorized(request))) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const recipients: { email: string; name?: string | null }[] = body?.to
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return Response.json({ error: 'Falta "to": [{ email, name? }]' }, { status: 400 })
  }

  await Promise.all(
    recipients.map(r => sendCommissionFreeCampaignEmail({ to: r.email, name: r.name ?? null }))
  )

  return Response.json({ ok: true, sent: recipients.length })
}
