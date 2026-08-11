import { createAdminClient } from '@/lib/supabase/admin'
import { sendInternationalAvailabilityReminderEmail } from '@/lib/email'

const REMINDER_DAYS = 7

// Se ejecuta semanalmente vía Vercel Cron (ver vercel.json). A propósito NO
// consulta Vinted ni ningún sitio de origen — ese tipo de automatización ya
// se descartó explícitamente para este proyecto (mismo criterio que el
// generador de Instagram: nunca scraping no autorizado). Esto solo le avisa
// a la admin cuáles prendas le faltan comprobar A MANO hace más de
// REMINDER_DAYS, reusando el flujo existente de "Comprobar disponibilidad".
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }
  if (!process.env.ADMIN_EMAIL) return Response.json({ skipped: 'no ADMIN_EMAIL' })

  const admin = createAdminClient()
  const cutoffISO = new Date(Date.now() - REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: listings, error } = await admin
    .from('listings')
    .select('id, title, sourcing:listing_sourcing(source_status, source_last_verified_at)')
    .eq('source_type', 'international_on_demand')
    .eq('status', 'active')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  type Row = { id: string; title: string; sourcing: { source_status: string; source_last_verified_at: string | null } | { source_status: string; source_last_verified_at: string | null }[] | null }
  const rows = (listings ?? []) as unknown as Row[]

  const overdue = rows
    .map(l => ({ ...l, sourcing: Array.isArray(l.sourcing) ? l.sourcing[0] ?? null : l.sourcing }))
    // Solo las que todavía tiene sentido revisar — no "comprada" ni "no disponible".
    .filter(l => l.sourcing && ['available', 'pending_verification'].includes(l.sourcing.source_status))
    .filter(l => !l.sourcing!.source_last_verified_at || l.sourcing!.source_last_verified_at < cutoffISO)

  if (overdue.length === 0) return Response.json({ sent: false, overdue: 0 })

  const items = overdue.map(l => ({
    listingId: l.id,
    title: l.title,
    daysSinceVerified: l.sourcing!.source_last_verified_at
      ? Math.floor((Date.now() - new Date(l.sourcing!.source_last_verified_at).getTime()) / (24 * 60 * 60 * 1000))
      : null,
  }))

  await sendInternationalAvailabilityReminderEmail({ to: process.env.ADMIN_EMAIL, items })

  return Response.json({ sent: true, overdue: overdue.length })
}
