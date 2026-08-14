'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function EditLabelTrackingForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [courier, setCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!courier.trim() || !trackingNumber.trim()) {
      setError('Completa transportista y número de seguimiento')
      return
    }

    setSending(true)
    setError('')

    const res = await fetch(`/api/admin/orders/${orderId}/label/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier: courier.trim(), trackingNumber: trackingNumber.trim() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      setSending(false)
      return
    }

    router.refresh()
    setSending(false)
  }

  return (
    <form onSubmit={handleSend} className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Esta orden tiene una etiqueta subida pero le falta el transportista/N.º de seguimiento — complétalo para que se muestre acá y en el seguimiento.
      </p>
      <div className="flex gap-2">
        <input
          value={courier}
          onChange={e => setCourier(e.target.value)}
          placeholder="Transportista, ej. Chilexpress"
          className="flex-1 border border-amber-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
        />
        <input
          value={trackingNumber}
          onChange={e => setTrackingNumber(e.target.value)}
          placeholder="N.º de seguimiento"
          className="flex-1 border border-amber-200 px-2 py-1.5 text-xs font-mono bg-white focus:outline-none focus:border-amber-400"
        />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="text-[10px] tracking-widest uppercase text-white bg-amber-600 px-3 py-1.5 hover:bg-amber-700 transition disabled:opacity-50"
      >
        {sending ? 'Guardando...' : 'Guardar'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </form>
  )
}
