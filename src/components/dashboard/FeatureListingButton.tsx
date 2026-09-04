'use client'

import { useState } from 'react'
import { BOOST_PRICE, BOOST_DURATION_DAYS } from '@/lib/catalog'

interface Props {
  listingId: string
  featuredUntil: string | null
}

export default function FeatureListingButton({ listingId, featuredUntil }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isFeatured = !!featuredUntil && new Date(featuredUntil) > new Date()

  async function feature() {
    if (loading) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/boost/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.redirectUrl) {
      setError(data?.error ?? 'No se pudo iniciar el pago')
      setLoading(false)
      return
    }
    window.location.href = data.redirectUrl
  }

  if (isFeatured) {
    const until = new Date(featuredUntil!).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' })
    return (
      <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-[#7fab87]/10 text-[#5a7a55]">
        Destacada hasta {until}
      </span>
    )
  }

  return (
    <div className="relative group inline-block">
      <button
        type="button"
        onClick={feature}
        disabled={loading}
        className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50"
      >
        {loading ? '...' : `Destacar — $${BOOST_PRICE.toLocaleString('es-CL')}`}
      </button>
      <div className="hidden group-hover:block absolute top-full right-0 mt-1 w-56 text-[10px] text-gray-600 bg-white p-2.5 shadow z-10 leading-relaxed normal-case tracking-normal">
        Tu prenda aparece en la fila &quot;Destacadas&quot; arriba del catálogo por {BOOST_DURATION_DAYS} días, sin importar cómo la gente ordene o filtre.
      </div>
      {error && (
        <p className="absolute top-full right-0 mt-1 w-48 text-[10px] text-red-500 bg-white p-1.5 shadow z-10">
          {error}
        </p>
      )}
    </div>
  )
}
