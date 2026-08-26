'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AbandonedCartActions({ orderId, alreadySent }: { orderId: string; alreadySent: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendReminder() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/orders/${orderId}/send-recovery-email`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al enviar el recordatorio')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3">
      <button onClick={sendReminder} disabled={loading}
        className="text-[10px] tracking-widest uppercase bg-black text-white px-4 py-2 hover:bg-gray-800 transition disabled:opacity-50">
        {loading ? 'Enviando...' : alreadySent ? 'Reenviar recordatorio' : 'Enviar recordatorio'}
      </button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  )
}
