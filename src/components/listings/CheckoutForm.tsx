'use client'

import { useState, useEffect } from 'react'
import ComunaSelect from '@/components/ComunaSelect'
import { buyerProtectionFee } from '@/lib/catalog'
import BuyerProtectionModal from '@/components/listings/BuyerProtectionModal'

interface CheckoutFormProps {
  listingId: string
  price: number
  initialValues?: {
    shipping_name?: string
    shipping_phone?: string
    shipping_address?: string
    shipping_comuna?: string
    shipping_city?: string
  }
}

export default function CheckoutForm({ listingId, price, initialValues }: CheckoutFormProps) {
  const [form, setForm] = useState({
    shipping_name: initialValues?.shipping_name ?? '',
    shipping_phone: initialValues?.shipping_phone ?? '',
    shipping_address: initialValues?.shipping_address ?? '',
    shipping_address_extra: '',
    shipping_comuna: initialValues?.shipping_comuna ?? '',
    shipping_city: initialValues?.shipping_city ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [quote, setQuote] = useState<{ cost: number; serviceCode: string } | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const quoteLoading = form.shipping_comuna !== '' && !quote && !quoteError
  const commission = buyerProtectionFee(price)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleComunaChange(v: string) {
    set('shipping_comuna', v)
    setQuote(null)
    setQuoteError('')
  }

  useEffect(() => {
    if (!form.shipping_comuna) return

    let cancelled = false

    fetch('/api/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, comuna: form.shipping_comuna }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return
        if (!ok) { setQuoteError(data.error || 'No pudimos cotizar el envío'); return }
        setQuote({ cost: data.price, serviceCode: data.serviceCode })
      })
      .catch(() => { if (!cancelled) setQuoteError('Error de conexión al cotizar el envío') })

    return () => { cancelled = true }
  }, [form.shipping_comuna, listingId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quote) { setError('Esperá a que se cotice el envío antes de continuar'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listingId,
          ...form,
          shipping_cost: quote.cost,
          courier_service_code: quote.serviceCode,
        }),
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
    <form onSubmit={handleSubmit} className="bg-white p-6 space-y-4">
      <p className="text-xs tracking-widest uppercase text-gray-500 mb-2">Dirección de envío</p>
      <p className="text-[10px] text-gray-400 -mt-3">
        La usamos solo para esta compra — puede ser distinta a tu dirección habitual.
      </p>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Nombre de quien recibe</label>
        <input value={form.shipping_name} onChange={e => set('shipping_name', e.target.value)} required
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Teléfono</label>
        <input type="tel" value={form.shipping_phone} onChange={e => set('shipping_phone', e.target.value)} required
          placeholder="+56 9 1234 5678"
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Dirección</label>
        <input value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)} required
          placeholder="Calle y número"
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Depto / casa / oficina (opcional)</label>
        <input value={form.shipping_address_extra} onChange={e => set('shipping_address_extra', e.target.value)}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Comuna</label>
          <ComunaSelect value={form.shipping_comuna} onChange={handleComunaChange} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white" />
        </div>
        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Ciudad / Región</label>
          <input value={form.shipping_city} onChange={e => set('shipping_city', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>

      {/* Desglose de precio */}
      <div className="bg-gray-50 p-4 text-xs text-gray-600 space-y-1">
        <div className="flex justify-between">
          <span>Prenda</span>
          <span>${price.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex justify-between">
          <BuyerProtectionModal
            trigger={<span className="underline decoration-dotted underline-offset-2 cursor-pointer hover:text-black">Protección Comprador</span>}
            triggerClassName="inline-flex"
          />
          <span>${commission.toLocaleString('es-CL')}</span>
        </div>
        <div className="flex justify-between">
          <span>Envío</span>
          <span>
            {!form.shipping_comuna ? 'Selecciona tu comuna' :
              quoteLoading ? 'Cotizando...' :
              quoteError ? <span className="text-red-500">{quoteError}</span> :
              quote ? `$${quote.cost.toLocaleString('es-CL')}` : '—'}
          </span>
        </div>
        <div className="flex justify-between font-medium text-[#5a7a55] border-t border-gray-200 pt-1 mt-1">
          <span>Total</span>
          <span>${(price + commission + (quote?.cost ?? 0)).toLocaleString('es-CL')}</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button type="submit" disabled={loading || !quote}
        className="w-full bg-black text-white text-xs tracking-widest uppercase py-4 hover:bg-gray-800 transition disabled:opacity-50">
        {loading ? 'Redirigiendo a pago...' : 'Continuar al pago'}
      </button>
      <p className="text-[10px] text-gray-400 text-center">
        Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción
      </p>
    </form>
  )
}
