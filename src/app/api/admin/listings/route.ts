import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Crea un listing a nombre de OTRA usuaria (no la admin autenticada) — para
// publicar a mano cuando alguien no puede/no logra hacerlo sola (ver
// /admin/users/[id] → "Publicar prenda para esta usuaria"). Mismo patrón que
// /api/admin/international/listings: pasa por el cliente service-role porque
// la policy "seller_id = auth.uid()" de un insert directo no aplicaría acá.
export async function POST(request: Request) {
  const user = await checkAdmin()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.seller_id !== 'string' || !body.seller_id) {
    return Response.json({ error: 'Falta "seller_id"' }, { status: 400 })
  }

  const requiredStrings = ['title', 'category', 'size', 'brand', 'condition']
  for (const field of requiredStrings) {
    if (typeof body[field] !== 'string' || !(body[field] as string).trim()) {
      return Response.json({ error: `Falta el campo "${field}"` }, { status: 400 })
    }
  }
  if (typeof body.price !== 'number' || body.price <= 0) {
    return Response.json({ error: 'El precio debe ser mayor a 0' }, { status: 400 })
  }
  if (!Array.isArray(body.photos) || body.photos.length === 0 || !body.photos.every(p => typeof p === 'string')) {
    return Response.json({ error: 'Agrega al menos una fotografía' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: seller } = await admin.from('profiles').select('id').eq('id', body.seller_id).maybeSingle()
  if (!seller) return Response.json({ error: 'Usuaria no encontrada' }, { status: 404 })

  const { data: listing, error: listingErr } = await admin
    .from('listings')
    .insert({
      seller_id: body.seller_id,
      title: body.title,
      description: typeof body.description === 'string' ? body.description : '',
      category: body.category,
      subcategory: '',
      size: body.size,
      brand: body.brand,
      condition: body.condition,
      colors: Array.isArray(body.colors) ? body.colors : [],
      shipping_size: typeof body.shipping_size === 'string' ? body.shipping_size : 'mediano',
      price: body.price,
      photos: body.photos,
      status: 'active',
      product_category: typeof body.product_category === 'string' ? body.product_category : null,
      product_type: typeof body.product_type === 'string' ? body.product_type : null,
    })
    .select('id')
    .single()

  if (listingErr || !listing) {
    return Response.json({ error: listingErr?.message ?? 'Error creando el listing' }, { status: 500 })
  }

  return Response.json({ id: listing.id })
}
