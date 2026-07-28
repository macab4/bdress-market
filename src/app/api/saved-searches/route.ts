import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let params: string
  let label: string | null
  try {
    const body = await request.json()
    params = body.params
    label = typeof body.label === 'string' ? body.label : null
    if (!params || typeof params !== 'string') throw new Error()
  } catch {
    return Response.json({ error: 'Falta "params"' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: user.id, params, label })
    .select('id')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, id: data.id })
}
