'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Respaldo cuando el courier ya confirma la entrega (en su propia página de
// seguimiento) pero la compradora nunca vuelve a confirmar recepción en la
// app (ver comentario en api/admin/orders/[id]/mark-delivered) — arranca el
// plazo para reportar un problema desde la fecha real de entrega, no desde
// "ahora".
export default function MarkDeliveredForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [deliveredAt, setDeliveredAt] = useState(() => toDatetimeLocalValue(new Date()))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')

    const res = await fetch(`/api/admin/orders/${orderId}/mark-delivered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivered_at: new Date(deliveredAt).toISOString() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al marcar como entregada')
      setSending(false)
      return
    }

    router.refresh()
    setSending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Marcar como entregada — usa esto si el courier ya confirma la entrega pero la compradora nunca la confirmó en la app.
      </p>
      <input
        type="datetime-local"
        value={deliveredAt}
        onChange={e => setDeliveredAt(e.target.value)}
        className="border border-amber-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
      />
      <button
        type="submit"
        disabled={sending}
        className="text-[10px] tracking-widest uppercase text-white bg-amber-600 px-3 py-1.5 hover:bg-amber-700 transition disabled:opacity-50 block"
      >
        {sending ? 'Guardando...' : 'Marcar como entregada'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </form>
  )
}
