import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// Reusa page_views (ya existe, ya la lee /admin/analytics) en vez de armar
// una tabla/plataforma de eventos nueva — un evento de clic se guarda como
// una fila más, con el nombre del evento en `path` bajo el prefijo
// "/_event/" para poder distinguirlo de una visita de página real. Mismo
// visitor_id que ya setea el middleware, así se pueden cruzar ambos.
const VISITOR_COOKIE = 'bdress_vid'

const ALLOWED_EVENTS = new Set([
  'click_home_sell_hero',
  'click_home_sell_banner',
  'click_home_sell_bottom_nav',
  'click_home_sell_how_it_works',
])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const event = typeof body?.event === 'string' ? body.event : ''
  if (!ALLOWED_EVENTS.has(event)) return Response.json({ error: 'Evento inválido' }, { status: 400 })

  const cookieStore = await cookies()
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value ?? crypto.randomUUID()

  const admin = createAdminClient()
  await admin.from('page_views').insert({ path: `/_event/${event}`, visitor_id: visitorId })

  return Response.json({ ok: true })
}
