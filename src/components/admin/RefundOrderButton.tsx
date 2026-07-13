'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RefundOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRefund() {
    if (!confirm('¿Reembolsar a la compradora y cancelar esta venta? La vendedora no despachó a tiempo.')) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/orders/${orderId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund' }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al reembolsar')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button onClick={handleRefund} disabled={loading}
        className="text-[10px] tracking-widest uppercase bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition disabled:opacity-50">
        {loading ? 'Reembolsando...' : 'Reembolsar a compradora'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
