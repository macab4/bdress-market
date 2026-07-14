'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OFFER_EXPIRY_HOURS } from '@/lib/catalog'

interface Props {
  listingId: string
  price: number
  minPrice: number
}

export default function MakeOfferModal({ listingId, price, minPrice }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const offered = parseInt(amount)
    if (!offered || offered <= 0) { setError('Ingresa un monto válido'); return }
    setLoading(true)
    setError('')

    const res = await fetch(`/api/listings/${listingId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_price: offered }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al enviar la oferta')
      setLoading(false)
      return
    }
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-black text-black text-xs tracking-widest uppercase py-4 hover:bg-black hover:text-white transition"
      >
        Hacer una oferta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div className="bg-white w-full sm:max-w-sm p-6" onClick={stop}>
            <h2 className="text-sm font-medium tracking-widest uppercase mb-1">Hacer una oferta</h2>
            <p className="text-xs text-gray-400 mb-4">
              Precio publicado: ${price.toLocaleString('es-CL')} · Oferta mínima: ${minPrice.toLocaleString('es-CL')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min={minPrice}
                  max={price - 1}
                  placeholder={String(minPrice)}
                  autoFocus
                  className="w-full border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-black text-white text-xs tracking-widest uppercase py-3 hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar oferta'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs tracking-widest uppercase text-gray-400 hover:text-black px-4"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] text-gray-400">
                La vendedora tiene {OFFER_EXPIRY_HOURS} horas para responder. Si acepta, vas a poder comprar al precio pactado.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
