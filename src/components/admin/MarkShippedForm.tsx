'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Respaldo cuando el courier ya recibió el paquete pero la vendedora nunca
// volvió a ingresar el número de seguimiento en la app (ver comentario en
// api/admin/orders/[id]/mark-shipped) — permite fijar la fecha real de
// despacho en vez de forzar "hoy".
export default function MarkShippedForm({ orderId, defaultTrackingNumber }: { orderId: string; defaultTrackingNumber: string }) {
  const router = useRouter()
  const [trackingNumber, setTrackingNumber] = useState(defaultTrackingNumber)
  const [shippedAt, setShippedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trackingNumber.trim()) { setError('Falta el número de seguimiento'); return }
    setSending(true)
    setError('')

    const res = await fetch(`/api/admin/orders/${orderId}/mark-shipped`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracking_number: trackingNumber.trim(), shipped_at: shippedAt }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al marcar como despachada')
      setSending(false)
      return
    }

    router.refresh()
    setSending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Marcar como despachada — usa esto si el courier ya recibió el paquete pero la vendedora nunca lo registró.
      </p>
      <div className="flex gap-2">
        <input
          value={trackingNumber}
          onChange={e => setTrackingNumber(e.target.value)}
          placeholder="N.º de seguimiento"
          className="flex-1 border border-amber-200 px-2 py-1.5 text-xs font-mono bg-white focus:outline-none focus:border-amber-400"
        />
        <input
          type="date"
          value={shippedAt}
          onChange={e => setShippedAt(e.target.value)}
          className="border border-amber-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
        />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="text-[10px] tracking-widest uppercase text-white bg-amber-600 px-3 py-1.5 hover:bg-amber-700 transition disabled:opacity-50"
      >
        {sending ? 'Guardando...' : 'Marcar como despachada'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </form>
  )
}
