import { createAdminClient } from '@/lib/supabase/admin'
import { sendActivateAccountWithReferralEmail } from '@/lib/email'

// Anuncio único (NO recurrente — vercel.json lo fija a una fecha puntual,
// mismo patrón que announce-referral-program) a cuentas que nunca
// iniciaron sesión. "No activada" se define igual que en /admin/users
// (columna "Activó cuenta"): auth.users.last_sign_in_at nulo — no hay un
// campo separado para esto en `profiles`. Se excluyen cuentas suspendidas
// (banned_until vigente), mismo criterio que ya usa ese panel.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, name'),
  ])

  const nameById = new Map((profiles ?? []).map(p => [p.id, p.name]))
  const now = new Date()

  const recipients = authData.users.filter(u => {
    const banned = !!u.banned_until && new Date(u.banned_until) > now
    return !u.last_sign_in_at && !banned && !!u.email
  })

  let sent = 0
  for (const user of recipients) {
    await sendActivateAccountWithReferralEmail({ to: user.email!, name: nameById.get(user.id) ?? null })
    sent++
  }

  return Response.json({ sent, evaluated: authData.users.length })
}
