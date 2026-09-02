'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm('¿Cancelar esta venta? Se reembolsará automáticamente a la compradora y no se puede deshacer.')) return
    setLoading(true)
    setError('')

    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al cancelar la venta')
      setLoading(false)
      return
    }
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 mt-3">
        Cancelar venta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <textarea value={reason} onChange={e => setReason(e.target.value)}
        rows={2} placeholder="¿Por qué cancelas? (opcional, se lo mostramos a la compradora)"
        className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading}
          className="text-[10px] tracking-widest uppercase bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition disabled:opacity-50">
          {loading ? 'Cancelando...' : 'Confirmar cancelación'}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black px-4 py-2">
          Volver
        </button>
      </div>
    </form>
  )
}
