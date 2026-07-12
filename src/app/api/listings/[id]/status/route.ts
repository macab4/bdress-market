import { createClient } from '@/lib/supabase/server'

const VALID_TRANSITIONS: Record<string, string> = {
  active: 'paused',
  paused: 'active',
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let status: string
  try {
    const body = await request.json()
    status = body.status
    if (!status) throw new Error()
  } catch {
    return Response.json({ error: 'status requerido' }, { status: 400 })
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, status')
    .eq('id', id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  if (VALID_TRANSITIONS[listing.status] !== status) {
    return Response.json({ error: `Transición inválida: ${listing.status} → ${status}` }, { status: 409 })
  }

  const { error } = await supabase
    .from('listings')
    .update({ status })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
