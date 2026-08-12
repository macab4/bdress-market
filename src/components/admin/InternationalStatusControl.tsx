'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListingStatus } from '@/types'

const LABEL: Record<ListingStatus, string> = {
  active: 'Publicada',
  paused: 'Pausada',
  sold: 'Vendida',
}

export default function InternationalStatusControl({ listingId, status }: { listingId: string; status: ListingStatus }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function setStatus(next: ListingStatus) {
    if (next === status) return setOpen(false)
    if (next === 'sold' && !confirm('¿Marcar esta prenda internacional como vendida?')) return
    setLoading(true)
    await fetch(`/api/admin/international/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black flex-shrink-0">
        {LABEL[status]}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {status !== 'active' && (
        <button onClick={() => setStatus('active')} disabled={loading} className="text-[10px] tracking-widest uppercase text-[#5a7a55] hover:text-black disabled:opacity-50">
          Reactivar
        </button>
      )}
      {status !== 'paused' && (
        <button onClick={() => setStatus('paused')} disabled={loading} className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black disabled:opacity-50">
          Pausar
        </button>
      )}
      {status !== 'sold' && (
        <button onClick={() => setStatus('sold')} disabled={loading} className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 disabled:opacity-50">
          Marcar vendida
        </button>
      )}
      <button onClick={() => setOpen(false)} className="text-[10px] text-gray-300 hover:text-black">✕</button>
    </div>
  )
}
