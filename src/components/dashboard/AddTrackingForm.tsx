'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddTrackingForm({ orderId }: { orderId: string }) {
  const [tracking, setTracking] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tracking.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/orders/${orderId}/ship`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_number: tracking }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        value={tracking}
        onChange={e => setTracking(e.target.value)}
        placeholder="Número de seguimiento"
        className="flex-1 border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <button
        type="submit"
        disabled={loading || !tracking.trim()}
        className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-1.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {loading ? '...' : 'Marcar enviado'}
      </button>
      {error && <p className="text-red-500 text-xs self-center">{error}</p>}
    </form>
  )
}
