'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RemoveFromCartButton({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function remove() {
    if (loading) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('cart_items').delete().eq('user_id', user.id).eq('listing_id', listingId)
    router.refresh()
  }

  return (
    <button type="button" onClick={remove} disabled={loading} aria-label="Quitar del carrito"
      className="text-gray-400 hover:text-black transition disabled:opacity-50">
      <X size={16} />
    </button>
  )
}
