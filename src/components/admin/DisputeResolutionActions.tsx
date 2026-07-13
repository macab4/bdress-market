'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DisputeResolutionActions({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'refund' | 'release' | null>(null)
  const [error, setError] = useState('')

  async function resolve(action: 'refund' | 'release') {
    const confirmMsg = action === 'refund'
      ? '¿Reembolsar a la compradora y cancelar esta venta?'
      : '¿Liberar el pago a la vendedora? Se marca la orden como completada.'
    if (!confirm(confirmMsg)) return

    setLoading(action)
    setError('')
    const res = await fetch(`/api/admin/orders/${orderId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al resolver la disputa')
      setLoading(null)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <button onClick={() => resolve('refund')} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition disabled:opacity-50">
          {loading === 'refund' ? 'Reembolsando...' : 'Reembolsar a compradora'}
        </button>
        <button onClick={() => resolve('release')} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase bg-[#8DA988] text-white px-4 py-2 hover:bg-green-700 transition disabled:opacity-50">
          {loading === 'release' ? 'Liberando...' : 'Liberar pago a vendedora'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
