'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FavoriteButtonProps {
  listingId: string
  initialFavorited: boolean
  initialCount?: number
  isLoggedIn: boolean
  buttonClassName?: string
}

export default function FavoriteButton({ listingId, initialFavorited, initialCount = 0, isLoggedIn, buttonClassName = '' }: FavoriteButtonProps) {
  const router = useRouter()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [count, setCount] = useState(initialCount)
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
      setCount(c => c - 1)
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
      if (deleteError) { setFavorited(true); setCount(c => c + 1); setError(deleteError.message) }
    } else {
      setFavorited(true)
      setCount(c => c + 1)
      const { error: insertError } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listingId })
      if (insertError) { setFavorited(false); setCount(c => c - 1); setError(insertError.message) }
    }
    setLoading(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={favorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
        className={`h-7 rounded-full bg-white/90 flex items-center justify-center gap-1 hover:bg-white transition ${count > 0 ? 'px-2' : 'w-7'} ${buttonClassName}`}
      >
        <Heart size={15} className={favorited ? 'fill-black text-black' : 'text-gray-500'} />
        {count > 0 && (
          <span className="text-[10px] font-medium text-gray-600 tabular-nums leading-none">{count}</span>
        )}
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-40 text-[10px] text-red-500 bg-white p-1.5 shadow z-10">
          {error}
        </p>
      )}
    </div>
  )
}
