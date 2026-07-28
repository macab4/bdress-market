'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteSavedSearchButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button onClick={handleDelete} disabled={loading}
      className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-red-600 disabled:opacity-50">
      {loading ? '...' : 'Eliminar'}
    </button>
  )
}
