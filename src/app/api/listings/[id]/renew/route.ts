import { createClient } from '@/lib/supabase/server'
import { BUMP_COOLDOWN_DAYS } from '@/lib/catalog'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id, status, bumped_at')
    .eq('id', id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  if (listing.status !== 'active') return Response.json({ error: 'Solo puedes renovar una prenda activa' }, { status: 409 })

  const nextEligibleAt = new Date(new Date(listing.bumped_at).getTime() + BUMP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  if (nextEligibleAt > new Date()) {
    return Response.json({
      error: `Ya renovaste esta prenda hace poco. Podrás renovarla de nuevo el ${nextEligibleAt.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}.`,
      nextEligibleAt: nextEligibleAt.toISOString(),
    }, { status: 409 })
  }

  const { error } = await supabase
    .from('listings')
    .update({ bumped_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
