import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bareKey } from '@/lib/brands'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL
}

// Fusiona sourceId dentro de targetId: mueve todos los aliases y listings
// de la marca origen al brand_id de destino, y elimina la marca origen (ya
// no le queda nada apuntando). No es fuzzy — es una fusión explícita que
// decide la administradora, no algo que decide el sistema solo (ver
// src/lib/brands.ts).
export async function POST(request: Request) {
  if (!(await checkAdmin())) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const sourceId = typeof body?.sourceId === 'string' ? body.sourceId : ''
  const targetId = typeof body?.targetId === 'string' ? body.targetId : ''
  if (!sourceId || !targetId || sourceId === targetId) {
    return Response.json({ error: 'Elige dos marcas distintas' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: source } = await admin.from('brands').select('id, display_name').eq('id', sourceId).single()
  if (!source) return Response.json({ error: 'Marca de origen no encontrada' }, { status: 404 })

  const { error: aliasErr } = await admin.from('brand_aliases').update({ brand_id: targetId }).eq('brand_id', sourceId)
  if (aliasErr) return Response.json({ error: aliasErr.message }, { status: 500 })

  // El nombre visible de la marca fusionada también queda como alias del
  // destino, por si no estaba ya registrado como tal.
  await admin.from('brand_aliases').insert({
    brand_id: targetId, alias: source.display_name, normalized_alias: bareKey(source.display_name),
  })

  const { error: listingsErr } = await admin.from('listings').update({ brand_id: targetId }).eq('brand_id', sourceId)
  if (listingsErr) return Response.json({ error: listingsErr.message }, { status: 500 })

  const { error: deleteErr } = await admin.from('brands').delete().eq('id', sourceId)
  if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 })

  return Response.json({ ok: true })
}
