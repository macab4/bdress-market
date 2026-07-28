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

  const update: { status?: string; photos?: string[]; product_category?: string; product_type?: string; pending_review?: boolean } = {}
  try {
    const body = await request.json()
    if (body.status !== undefined) {
      if (!['active', 'paused'].includes(body.status)) throw new Error()
      update.status = body.status
    }
    if (body.photos !== undefined) {
      if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every((p: unknown) => typeof p === 'string')) throw new Error()
      update.photos = body.photos
    }
    if (body.product_category !== undefined) {
      if (typeof body.product_category !== 'string' || !body.product_category) throw new Error()
      update.product_category = body.product_category
    }
    if (body.product_type !== undefined) {
      if (typeof body.product_type !== 'string' || !body.product_type) throw new Error()
      update.product_type = body.product_type
    }
    if (body.pending_review !== undefined) {
      if (typeof body.pending_review !== 'boolean') throw new Error()
      update.pending_review = body.pending_review
    }
    if (Object.keys(update).length === 0) throw new Error()
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('listings').update(update).eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('listings').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
