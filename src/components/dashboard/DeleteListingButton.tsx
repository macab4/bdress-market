'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  listingTitle: string
}

export default function DeleteListingButton({ listingId, listingTitle }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${listingTitle}"? Esta acción no se puede deshacer.`)) return

    setLoading(true)
    const res = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'No se pudo eliminar la prenda.' }))
      alert(error)
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-red-600 disabled:opacity-50"
    >
      {loading ? '...' : 'Eliminar'}
    </button>
  )
}
