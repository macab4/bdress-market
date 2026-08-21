import { createClient } from '@/lib/supabase/server'
import MainNavClient from './MainNavClient'

export default async function MainNav() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <MainNavClient isLoggedIn={user !== null} />
}
