import { createAdminClient } from '@/lib/supabase/admin'

// Los listings internacionales necesitan un seller_id (FK obligatoria a
// profiles) para encajar en el esquema actual — se publican a nombre de un
// perfil de sistema "Bdress Internacional" en vez de una vendedora real
// (decisión tomada con el usuario). Este helper busca ese perfil por un
// email fijo y lo crea la primera vez que se necesita, vía el mismo trigger
// handle_new_user() que ya crea profiles al registrarse cualquier usuaria.
const HOUSE_SELLER_EMAIL = process.env.INTERNATIONAL_HOUSE_EMAIL || 'internacional@bdressmarket.cl'
const HOUSE_SELLER_NAME = 'Bdress Internacional'

let cachedId: string | null = null

export async function getOrCreateHouseSellerId(): Promise<string> {
  if (cachedId) return cachedId

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', HOUSE_SELLER_EMAIL)
    .maybeSingle()

  if (existing) {
    cachedId = existing.id
    return existing.id
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: HOUSE_SELLER_EMAIL,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: { name: HOUSE_SELLER_NAME },
  })

  if (error || !created?.user) {
    throw new Error(`No se pudo crear el perfil de sistema "${HOUSE_SELLER_NAME}": ${error?.message ?? 'error desconocido'}`)
  }

  // El trigger handle_new_user() ya crea el profile con name='' — lo
  // completamos con el nombre visible que va a ver la clienta.
  await admin.from('profiles').update({ name: HOUSE_SELLER_NAME }).eq('id', created.user.id)

  cachedId = created.user.id
  return created.user.id
}
