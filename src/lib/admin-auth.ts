import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/')
  }
  return user
}

export function isAdminEmail(email: string | null | undefined) {
  return !!email && email === process.env.ADMIN_EMAIL
}
