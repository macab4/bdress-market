'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FavoriteButtonProps {
  listingId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  className?: string
}

export default function FavoriteButton({ listingId, initialFavorited, isLoggedIn, className = '' }: FavoriteButtonProps) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isLoggedIn) {
      router.push('/auth/login')
      return
    }
    if (loading) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    if (favorited) {
      setFavorited(false)
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
      if (error) setFavorited(true)
    } else {
      setFavorited(true)
      const { error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId })
      if (error) setFavorited(false)
    }
    setLoading(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition ${className}`}
    >
      <Heart size={15} className={favorited ? 'fill-black text-black' : 'text-gray-500'} />
    </button>
  )
}
