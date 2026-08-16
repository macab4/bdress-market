'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Último paso del reembolso con devolución: la admin confirma (viendo el
// seguimiento del courier) que la prenda ya está en manos de la vendedora
// — recién con este clic se ejecuta el reembolso real a la compradora.
export default function MarkReturnReceivedForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    if (!confirm('¿Confirmas que la vendedora ya recibió la prenda devuelta? Esto ejecuta el reembolso a la compradora — no se puede deshacer.')) return
    setSending(true)
    setError('')

    const res = await fetch(`/api/admin/orders/${orderId}/mark-return-received`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al confirmar la devolución')
      setSending(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Verifica el seguimiento del courier — si ya dice entregado, confirma acá para ejecutar el reembolso.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="text-[10px] tracking-widest uppercase text-white bg-amber-600 px-3 py-1.5 hover:bg-amber-700 transition disabled:opacity-50"
      >
        {sending ? 'Procesando...' : 'Devolución recibida — reembolsar'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </div>
  )
}
