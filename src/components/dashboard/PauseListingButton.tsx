'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  currentStatus: 'active' | 'paused'
  /** Botón grande de borde completo (ficha de producto) en vez del link chico por defecto (perfil/dashboard). */
  variant?: 'compact' | 'block'
}

export default function PauseListingButton({ listingId, currentStatus, variant = 'compact' }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    setLoading(true)
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    await fetch(`/api/listings/${listingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoading(false)
  }

  const label = currentStatus === 'active' ? 'Pausar publicación' : 'Reactivar publicación'

  if (variant === 'block') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className="block w-full text-center border border-gray-300 text-gray-700 text-xs tracking-widest uppercase py-4 hover:border-[#7fab87] hover:text-[#7fab87] transition disabled:opacity-50"
      >
        {loading ? '...' : label}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50"
    >
      {loading ? '...' : currentStatus === 'active' ? 'Pausar' : 'Activar'}
    </button>
  )
}
