'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface FollowButtonProps {
  followedId: string
  initialFollowing: boolean
  isLoggedIn: boolean
}

export default function FollowButton({ followedId, initialFollowing, isLoggedIn }: FollowButtonProps) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    if (!isLoggedIn) {
      router.push('/auth/login')
      return
    }
    if (loading) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    if (following) {
      setFollowing(false)
      const { error: deleteError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('followed_id', followedId)
      if (deleteError) { setFollowing(true); setError(deleteError.message) }
    } else {
      setFollowing(true)
      const { error: insertError } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, followed_id: followedId })
      if (insertError) { setFollowing(false); setError(insertError.message) }
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={
          following
            ? 'text-[10px] tracking-widest uppercase text-gray-500 hover:text-black border border-gray-200 px-4 py-2 disabled:opacity-50'
            : 'text-[10px] tracking-widest uppercase text-white bg-[#7fab87] hover:bg-[#6f9678] px-4 py-2 disabled:opacity-50'
        }
      >
        {following ? 'Siguiendo' : '+ Seguir'}
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-40 text-[10px] text-red-500 bg-white p-1.5 shadow z-10">
          {error}
        </p>
      )}
    </div>
  )
}
