import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bareKey } from '@/lib/brands'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Agrega una grafía conocida a una marca ya existente. Si algún listing
// quedó con ese texto exacto y sin brand_id (todavía no migrado), se
// asigna de inmediato.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const body = await request.json().catch(() => null)
  const alias = typeof body?.alias === 'string' ? body.alias.trim() : ''
  if (!alias) return Response.json({ error: 'alias requerido' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('brand_aliases').insert({ brand_id: id, alias, normalized_alias: bareKey(alias) })
  if (error) {
    const friendly = error.message.includes('duplicate') || error.message.includes('unique')
      ? 'Ese texto ya está registrado como alias de otra marca'
      : error.message
    return Response.json({ error: friendly }, { status: 409 })
  }

  await admin.from('listings').update({ brand_id: id }).eq('brand', alias).is('brand_id', null)

  return Response.json({ ok: true })
}
