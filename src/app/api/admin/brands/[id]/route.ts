import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bareKey, slugifyBrand } from '@/lib/brands'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Renombra el nombre visible y/o el slug de una marca canónica. La grafía
// anterior queda registrada como alias (si no lo estaba ya) para que links
// y búsquedas viejas sigan resolviendo a la misma marca.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const body = await request.json().catch(() => null)
  const newDisplayName = typeof body?.display_name === 'string' ? body.display_name.trim() : ''
  const newSlug = typeof body?.slug === 'string' ? body.slug.trim() : ''
  if (!newDisplayName && !newSlug) return Response.json({ error: 'Nada para actualizar' }, { status: 400 })

  const admin = createAdminClient()
  const { data: current } = await admin.from('brands').select('display_name, slug').eq('id', id).single()
  if (!current) return Response.json({ error: 'Marca no encontrada' }, { status: 404 })

  const update: Record<string, string> = { updated_at: new Date().toISOString() }
  if (newDisplayName) {
    update.display_name = newDisplayName
    update.normalized_name = bareKey(newDisplayName)
  }
  if (newSlug) update.slug = slugifyBrand(newSlug)

  const { error } = await admin.from('brands').update(update).eq('id', id)
  if (error) {
    const friendly = error.message.includes('normalized_name') ? 'Ya existe otra marca con un nombre equivalente'
      : error.message.includes('slug') ? 'Ese slug ya está en uso por otra marca'
      : error.message
    return Response.json({ error: friendly }, { status: 409 })
  }

  // La grafía vieja sigue siendo válida para buscar/enlazar — se guarda
  // como alias si todavía no existía uno igual.
  if (newDisplayName && newDisplayName !== current.display_name) {
    await admin.from('brand_aliases').insert({
      brand_id: id, alias: current.display_name, normalized_alias: bareKey(current.display_name),
    })
  }

  return Response.json({ ok: true })
}
