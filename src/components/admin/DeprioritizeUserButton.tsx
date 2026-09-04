'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeprioritizeUserButton({ userId, deprioritized }: { userId: string; deprioritized: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deprioritized: !deprioritized }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`text-[10px] tracking-widest uppercase px-4 py-2 border flex-shrink-0 disabled:opacity-50 ${
        deprioritized ? 'border-[#7fab87] text-[#7fab87] hover:bg-[#7fab87]/10' : 'border-gray-200 text-gray-500 hover:text-black'
      }`}>
      {loading ? '...' : deprioritized ? 'Quitar del final del catálogo' : 'Mandar al final del catálogo'}
    </button>
  )
}
