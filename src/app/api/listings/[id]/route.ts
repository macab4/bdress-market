import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  const { data: listing } = await supabase
    .from('listings')
    .select('id, seller_id')
    .eq('id', id)
    .single()

  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })
  if (listing.seller_id !== user.id) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    if (error.code === '23503') {
      return Response.json(
        { error: 'No puedes eliminar esta prenda porque tiene un pedido o mensaje asociado. Pausa la publicación en su lugar.' },
        { status: 409 }
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!deleted || deleted.length === 0) {
    return Response.json({ error: 'No se pudo eliminar la prenda (permiso denegado).' }, { status: 403 })
  }

  return Response.json({ ok: true })
}
