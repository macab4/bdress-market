'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleConfirm() {
    if (!confirm('¿Confirmas que recibiste la prenda en buen estado? Vas a tener 2 días para reportar un problema si algo no está bien.')) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/orders/${orderId}/confirm`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al confirmar')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <button
        onClick={handleConfirm}
        disabled={loading}
        className="bg-[#8DA988] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-green-700 transition disabled:opacity-50"
      >
        {loading ? 'Confirmando...' : 'Confirmar recepción'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
