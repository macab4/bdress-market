import { createClient } from '@/lib/supabase/server'
import MobileTabBarClient from './MobileTabBarClient'

export default async function MobileTabBar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <MobileTabBarClient isLoggedIn={user !== null} userId={user?.id} />
}
