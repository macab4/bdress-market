'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MarkFlagReviewed({ flagId, reviewed }: { flagId: string; reviewed: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    await fetch(`/api/admin/message-flags/${flagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: !reviewed }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`text-[10px] tracking-widest uppercase px-3 py-1.5 border flex-shrink-0 disabled:opacity-50 ${
        reviewed ? 'border-gray-200 text-gray-400 hover:text-black' : 'border-[#7fab87] text-[#5a7a55] hover:bg-[#7fab87]/10'
      }`}>
      {loading ? '...' : reviewed ? 'Marcar pendiente' : 'Marcar revisada'}
    </button>
  )
}
