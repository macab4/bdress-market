'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  currentStatus: 'active' | 'paused'
}

export default function PauseListingButton({ listingId, currentStatus }: Props) {
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
