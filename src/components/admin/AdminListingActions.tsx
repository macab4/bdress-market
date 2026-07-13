'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminListingActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function setStatus(newStatus: string) {
    setLoading(true)
    await fetch(`/api/admin/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta prenda de forma permanente? Esta acción no se puede deshacer.')) return
    setLoading(true)
    await fetch(`/api/admin/listings/${listingId}`, { method: 'DELETE' })
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {status === 'active' && (
        <button onClick={() => setStatus('paused')} disabled={loading}
          className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50">
          Pausar
        </button>
      )}
      {status === 'paused' && (
        <button onClick={() => setStatus('active')} disabled={loading}
          className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50">
          Reactivar
        </button>
      )}
      <button onClick={handleDelete} disabled={loading}
        className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 disabled:opacity-50">
        Eliminar
      </button>
    </div>
  )
}
