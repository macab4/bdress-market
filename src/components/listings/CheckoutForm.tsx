'use client'

import { useState } from 'react'

interface CheckoutFormProps {
  listingId: string
}

export default function CheckoutForm({ listingId }: CheckoutFormProps) {
  const [form, setForm] = useState({
    shipping_name: '', shipping_phone: '', shipping_address: '',
    shipping_address_extra: '', shipping_comuna: '', shipping_city: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, ...form }),
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
          <input value={form.shipping_comuna} onChange={e => set('shipping_comuna', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Ciudad / Región</label>
          <input value={form.shipping_city} onChange={e => set('shipping_city', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full bg-black text-white text-xs tracking-widest uppercase py-4 hover:bg-gray-800 transition disabled:opacity-50">
        {loading ? 'Redirigiendo a pago...' : 'Continuar al pago'}
      </button>
      <p className="text-[10px] text-gray-400 text-center">
        Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción
      </p>
    </form>
  )
}
