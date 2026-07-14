'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { OFFER_EXPIRY_HOURS, OFFER_PRESET_DISCOUNTS } from '@/lib/catalog'

interface Props {
  listingId: string
  sellerId: string
  price: number
  minPrice: number
}

type Selection = number | 'custom' | null

export default function MakeOfferModal({ listingId, sellerId, price, minPrice }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Selection>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const presetPrices = OFFER_PRESET_DISCOUNTS.map(pct => Math.round(price * (1 - pct)))

  const offeredPrice =
    selected === 'custom' ? parseInt(customAmount) || 0 :
    selected !== null ? presetPrices[selected] :
    0

  const customError =
    selected === 'custom' && customAmount !== '' && offeredPrice < minPrice
      ? `El valor es demasiado bajo. El mínimo es $${minPrice.toLocaleString('es-CL')}`
      : selected === 'custom' && customAmount !== '' && offeredPrice >= price
        ? 'El valor debe ser menor al precio publicado'
        : ''

  const canSubmit = offeredPrice > 0 && offeredPrice >= minPrice && offeredPrice < price

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation()
  }

  function close() {
    setOpen(false)
    setSelected(null)
    setCustomAmount('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError('')

    const res = await fetch(`/api/listings/${listingId}/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offered_price: offeredPrice }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al enviar la oferta')
      setLoading(false)
      return
    }
    setLoading(false)
    close()
    // Como en Vinted: hacer una oferta abre la conversación con la vendedora,
    // donde queda visible y se puede seguir negociando.
    router.push(`/dashboard/messages/${listingId}/${sellerId}`)
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
          onClick={close}
        >
          <div className="bg-white w-full sm:max-w-sm sm:rounded p-6" onClick={stop}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-medium tracking-widest uppercase">Hacer una oferta</h2>
              <button type="button" onClick={close} aria-label="Cerrar" className="text-gray-400 hover:text-black">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Precio del artículo: ${price.toLocaleString('es-CL')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {presetPrices.map((presetPrice, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`text-left border rounded p-2.5 transition ${
                      selected === i ? 'border-[#5a7a55] ring-1 ring-[#5a7a55]' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-medium">${presetPrice.toLocaleString('es-CL')}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">{Math.round(OFFER_PRESET_DISCOUNTS[i] * 100)}% descuento</p>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelected('custom')}
                  className={`text-left border rounded p-2.5 transition ${
                    selected === 'custom' ? 'border-[#5a7a55] ring-1 ring-[#5a7a55]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium">Personalizar</p>
                  <p className="text-[9px] text-gray-400 mt-0.5">Ponle un precio</p>
                </button>
              </div>

              {selected === 'custom' && (
                <div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      autoFocus
                      placeholder={String(minPrice)}
                      className="w-full border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  {customError && <p className="text-red-500 text-xs mt-1">{customError}</p>}
                </div>
              )}

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="w-full bg-[#5a7a55] text-white text-sm py-3 hover:bg-[#4a6647] transition disabled:opacity-40"
              >
                {loading ? 'Enviando...' : offeredPrice > 0 ? `Ofrecer $${offeredPrice.toLocaleString('es-CL')}` : 'Ofrecer'}
              </button>

              <p className="text-[10px] text-gray-400 text-center">
                La vendedora tiene {OFFER_EXPIRY_HOURS} horas para responder. Si acepta, vas a poder comprar al precio pactado.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
