'use client'

import { useState } from 'react'

interface BuyButtonProps {
  listingId: string
  price: number
}

export default function BuyButton({ listingId, price }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleBuy() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar el pago')
        setLoading(false)
        return
      }
      window.location.href = data.redirectUrl
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleBuy}
        disabled={loading}
        className="w-full bg-black text-white text-xs tracking-widest uppercase py-4 hover:bg-gray-800 transition disabled:opacity-50"
      >
        {loading ? 'Redirigiendo a pago...' : `Comprar — $${price.toLocaleString('es-CL')}`}
      </button>
      {error && <p className="text-red-500 text-xs text-center">{error}</p>}
      <p className="text-[10px] text-gray-400 text-center">
        Pago seguro vía Flow · Bdress retiene hasta confirmar recepción
      </p>
    </div>
  )
}
