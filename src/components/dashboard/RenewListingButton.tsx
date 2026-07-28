'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BUMP_COOLDOWN_DAYS } from '@/lib/catalog'

interface Props {
  listingId: string
  bumpedAt: string
}

export default function RenewListingButton({ listingId, bumpedAt }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const nextEligibleAt = new Date(new Date(bumpedAt).getTime() + BUMP_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  const eligible = nextEligibleAt <= new Date()

  async function renew() {
    if (loading) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/listings/${listingId}/renew`, { method: 'PATCH' })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'No se pudo renovar')
      setLoading(false)
      return
    }
    router.refresh()
    setLoading(false)
  }

  if (!eligible) {
    return (
      <span className="text-[10px] tracking-widest uppercase text-gray-300" title="Disponible de nuevo el">
        Renovada
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={renew}
        disabled={loading}
        className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50"
      >
        {loading ? '...' : 'Renovar'}
      </button>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-48 text-[10px] text-red-500 bg-white p-1.5 shadow z-10">
          {error}
        </p>
      )}
    </div>
  )
}
