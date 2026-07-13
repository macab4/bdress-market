'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SuspendUserButton({ userId, banned }: { userId: string; banned: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!banned && !confirm('¿Suspender esta cuenta? No va a poder iniciar sesión hasta que la reactives.')) return
    setLoading(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !banned }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`text-[10px] tracking-widest uppercase px-4 py-2 border flex-shrink-0 disabled:opacity-50 ${
        banned ? 'border-gray-200 text-gray-500 hover:text-black' : 'border-red-200 text-red-500 hover:bg-red-50'
      }`}>
      {loading ? '...' : banned ? 'Reactivar cuenta' : 'Suspender cuenta'}
    </button>
  )
}
