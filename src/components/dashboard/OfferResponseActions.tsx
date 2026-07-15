'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  offerId: string
  minPrice: number
  maxPrice: number
  canCounter: boolean
}

export default function OfferResponseActions({ offerId, minPrice, maxPrice, canCounter }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'counter'>('idle')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function respond(action: 'accept' | 'reject' | 'counter', offered_price?: number) {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/offers/${offerId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(offered_price ? { offered_price } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al responder')
      setLoading(false)
      return
    }
    router.refresh()
  }

  function handleCounterSubmit(e: React.FormEvent) {
    e.preventDefault()
    const offered = parseInt(amount)
    if (!offered || offered <= 0) { setError('Ingresa un monto válido'); return }
    respond('counter', offered)
  }

  if (mode === 'counter') {
    return (
      <form onSubmit={handleCounterSubmit} className="flex flex-col gap-2 mt-2">
        <div className="relative">
          <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min={minPrice}
            max={maxPrice}
            autoFocus
            placeholder={String(minPrice)}
            className="w-full border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="text-[10px] tracking-widest uppercase bg-[#7fab87] text-white px-4 py-2 hover:bg-[#6f9678] transition disabled:opacity-50">
            {loading ? 'Enviando...' : 'Enviar contraoferta'}
          </button>
          <button type="button" onClick={() => setMode('idle')}
            className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black px-2">
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="mt-2">
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={loading} onClick={() => respond('accept')}
          className="text-[10px] tracking-widest uppercase bg-[#7fab87] text-white px-4 py-2 hover:bg-[#6f9678] transition disabled:opacity-50">
          Aceptar
        </button>
        {canCounter && (
          <button type="button" disabled={loading} onClick={() => setMode('counter')}
            className="text-[10px] tracking-widest uppercase border border-gray-300 px-4 py-2 hover:border-[#7fab87] transition disabled:opacity-50">
            Contraofertar
          </button>
        )}
        <button type="button" disabled={loading} onClick={() => respond('reject')}
          className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 px-3 py-2">
          Rechazar
        </button>
      </div>
    </div>
  )
}
