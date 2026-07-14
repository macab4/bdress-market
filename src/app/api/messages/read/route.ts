import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let listingId: string
  let otherUserId: string
  try {
    const body = await request.json()
    listingId = body.listing_id
    otherUserId = body.other_user_id
    if (!listingId || !otherUserId) throw new Error()
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('listing_id', listingId)
    .eq('sender_id', otherUserId)
    .eq('receiver_id', user.id)
    .is('read_at', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
