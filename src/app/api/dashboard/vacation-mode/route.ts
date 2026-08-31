import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let vacationMode: boolean
  try {
    const body = await request.json()
    if (typeof body.vacation_mode !== 'boolean') throw new Error()
    vacationMode = body.vacation_mode
  } catch {
    return Response.json({ error: 'vacation_mode (boolean) requerido' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ vacation_mode: vacationMode })
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, vacation_mode: vacationMode })
}
