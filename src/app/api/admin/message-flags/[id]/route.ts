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

  let reviewed: boolean
  try {
    const body = await request.json()
    reviewed = !!body.reviewed
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('message_flags')
    .update({ reviewed_at: reviewed ? new Date().toISOString() : null })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
