import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/types'
import EditProfileForm from '@/components/profile/EditProfileForm'

export default async function EditProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single() as unknown as { data: Profile | null }

  if (!profile) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-[#EBEBEB] py-10 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8 text-center">
          Editar perfil
        </h1>
        <EditProfileForm profile={profile} />
      </div>
    </div>
  )
}
