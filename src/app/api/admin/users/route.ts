import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendManualAccountWelcomeEmail } from '@/lib/email'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Crea una cuenta a mano (ej. una vendedora de la lista de contactos a la
// que se le da de alta por adelantado) sin que ella se registre — igual
// patrón que getOrCreateHouseSellerId (contraseña aleatoria descartada, el
// trigger handle_new_user() crea el profile). No conoce su contraseña,
// así que el siguiente paso siempre es sendManualAccountWelcomeEmail
// invitándola a poner una vía "olvidé mi contraseña".
export async function POST(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''

  if (!name) return Response.json({ error: 'Falta el nombre' }, { status: 400 })
  if (!EMAIL_RE.test(email)) return Response.json({ error: 'Email inválido' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) return Response.json({ error: 'Ya existe una cuenta con ese email' }, { status: 409 })

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { name },
  })

  if (error || !created?.user) {
    return Response.json({ error: error?.message ?? 'No se pudo crear la cuenta' }, { status: 500 })
  }

  if (phone) {
    await admin.from('profiles').update({ phone }).eq('id', created.user.id)
  }

  await sendManualAccountWelcomeEmail({ to: email, name })

  return Response.json({ ok: true, id: created.user.id })
}
