'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FavoriteButtonProps {
  listingId: string
  initialFavorited: boolean
  isLoggedIn: boolean
  buttonClassName?: string
}

export default function FavoriteButton({ listingId, initialFavorited, isLoggedIn, buttonClassName = '' }: FavoriteButtonProps) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

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

    if (favorited) {
      setFavorited(false)
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
      if (deleteError) { setFavorited(true); setError(deleteError.message) }
    } else {
      setFavorited(true)
      const { error: insertError } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId })
      if (insertError) { setFavorited(false); setError(insertError.message) }
    }
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={favorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        className={`w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition ${buttonClassName}`}
      >
        <Heart size={15} className={favorited ? 'fill-black text-black' : 'text-gray-500'} />
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-40 text-[10px] text-red-500 bg-white p-1.5 shadow z-10">
          {error}
        </p>
      )}
    </div>
  )
}
