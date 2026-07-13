'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateLabelButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleClick() {
    if (!confirm('¿Generar la etiqueta de envío para esta venta? Te la mandamos por correo para que la imprimas.')) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/orders/${orderId}/generate-label`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al generar la etiqueta')
      setLoading(false)
      return
    }
    alert('¡Etiqueta generada! Te la mandamos a tu correo para que la imprimas.')
    router.refresh()
  }

  return (
    <div className="mt-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-black text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-gray-800 transition disabled:opacity-50"
      >
        {loading ? 'Generando etiqueta...' : 'Generar etiqueta de envío'}
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  )
}
