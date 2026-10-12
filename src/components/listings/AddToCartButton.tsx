'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AddToCartButtonProps {
  listingId: string
  initialInCart: boolean
  isLoggedIn: boolean
}

// Mismo patrón optimista que FavoriteButton — a diferencia de "Comprar"
// (que te lleva directo al checkout de esa prenda), este solo guarda la
// intención de compra para pagarla junto con otras prendas de otras
// vendedoras desde /cart. No reserva la prenda — eso sigue pasando recién
// al pagar, igual que la compra directa de siempre.
export default function AddToCartButton({ listingId, initialInCart, isLoggedIn }: AddToCartButtonProps) {
  const router = useRouter()
  const [inCart, setInCart] = useState(initialInCart)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    if (!isLoggedIn) { router.push('/auth/login'); return }
    if (loading) return
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    if (inCart) {
      setInCart(false)
      const { error: deleteError } = await supabase.from('cart_items').delete().eq('user_id', user.id).eq('listing_id', listingId)
      if (deleteError) { setInCart(true); setError(deleteError.message) }
    } else {
      setInCart(true)
      const { error: insertError } = await supabase.from('cart_items').insert({ user_id: user.id, listing_id: listingId })
      if (insertError) { setInCart(false); setError(insertError.message) }
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`block w-full text-center text-xs tracking-widest uppercase py-4 transition disabled:opacity-50 ${
          inCart
            ? 'bg-black text-white hover:bg-gray-800'
            : 'border border-gray-300 text-gray-700 hover:border-black hover:text-black'
        }`}
      >
        {inCart ? 'Quitar del carrito' : 'Agregar al carrito'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
