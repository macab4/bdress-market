import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  let body: { banned?: unknown; deprioritized?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  if ('banned' in body) {
    if (typeof body.banned !== 'boolean') return Response.json({ error: 'banned inválido' }, { status: 400 })
    const { error } = await admin.auth.admin.updateUserById(id, {
      ban_duration: body.banned ? '87600h' : 'none',
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  if ('deprioritized' in body) {
    if (typeof body.deprioritized !== 'boolean') return Response.json({ error: 'deprioritized inválido' }, { status: 400 })
    const { error } = await admin.from('profiles').update({ deprioritized: body.deprioritized }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
