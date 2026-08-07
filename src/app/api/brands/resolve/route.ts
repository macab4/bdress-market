import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bareKey, slugifyBrand } from '@/lib/brands'

// Encuentra-o-crea una marca a partir de texto libre. Reglas (nunca fuzzy
// matching, ver src/lib/brands.ts):
//   1. Alias ya registrado con el mismo bareKey → reutiliza ese brand_id.
//   2. normalized_name de una marca existente igual al bareKey → reutiliza
//      esa marca y registra esta grafía como alias nuevo.
//   3. Si no hay ninguna coincidencia exacta (tras normalizar formato), se
//      crea una marca nueva — nunca se fusiona con algo "parecido".
// Cualquier usuaria autenticada puede llamarlo (así es como se publica hoy
// una prenda) — la escritura real pasa por el cliente service-role para
// controlar la lógica de dedup, no por una policy de insert abierta.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let input: string
  try {
    const body = await request.json()
    input = typeof body.brand === 'string' ? body.brand.trim() : ''
    if (!input) throw new Error()
    if (input.length > 80) throw new Error()
  } catch {
    return Response.json({ error: 'brand requerido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const key = bareKey(input)

  const { data: aliasMatch } = await admin
    .from('brand_aliases')
    .select('brand:brands(id, display_name, slug)')
    .eq('normalized_alias', key)
    .maybeSingle()

  const aliasBrand = Array.isArray(aliasMatch?.brand) ? aliasMatch?.brand[0] : aliasMatch?.brand
  if (aliasBrand) {
    return Response.json({ id: aliasBrand.id, display_name: aliasBrand.display_name, slug: aliasBrand.slug, created: false })
  }

  const { data: brandMatch } = await admin
    .from('brands')
    .select('id, display_name, slug')
    .eq('normalized_name', key)
    .maybeSingle()

  if (brandMatch) {
    if (brandMatch.display_name !== input) {
      await admin.from('brand_aliases').insert({ brand_id: brandMatch.id, alias: input, normalized_alias: key })
    }
    return Response.json({ ...brandMatch, created: false })
  }

  const slug = await uniqueSlug(admin, slugifyBrand(input))
  const { data: created, error: createErr } = await admin
    .from('brands')
    .insert({ display_name: input, slug, normalized_name: key })
    .select('id, display_name, slug')
    .single()

  if (createErr) {
    // Carrera: alguien más acaba de crear la misma marca (normalized_name
    // es unique) — en vez de fallar, se busca de nuevo y se reutiliza.
    const { data: retry } = await admin.from('brands').select('id, display_name, slug').eq('normalized_name', key).maybeSingle()
    if (retry) return Response.json({ ...retry, created: false })
    return Response.json({ error: createErr.message }, { status: 500 })
  }

  await admin.from('brand_aliases').insert({ brand_id: created.id, alias: input, normalized_alias: key })

  return Response.json({ ...created, created: true })
}

async function uniqueSlug(admin: ReturnType<typeof createAdminClient>, base: string): Promise<string> {
  let candidate = base
  for (let i = 2; i < 50; i++) {
    const { data } = await admin.from('brands').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${i}`
  }
  return `${base}-${Date.now()}`
}
