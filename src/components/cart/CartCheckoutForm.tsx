'use client'

import { useState, useEffect } from 'react'
import ComunaSelect from '@/components/ComunaSelect'
import { buyerProtectionFee } from '@/lib/catalog'
import BuyerProtectionModal from '@/components/listings/BuyerProtectionModal'

interface CartItem {
  listingId: string
  title: string
  price: number
  sellerName: string
}

interface CartCheckoutFormProps {
  items: CartItem[]
  walletAvailableBalance?: number
  promoBalance?: number
  initialValues?: {
    shipping_name?: string
    shipping_phone?: string
    shipping_address?: string
    shipping_comuna?: string
    shipping_city?: string
  }
}

// Igual que CheckoutForm (compra directa de una prenda), pero cotiza y
// pagan juntas varias prendas de distintas vendedoras — cada una sigue
// siendo su propia orden/despacho por dentro (ver /api/cart/checkout), acá
// solo se ve como un total combinado con una sola dirección de envío.
export default function CartCheckoutForm({ items, walletAvailableBalance = 0, promoBalance = 0, initialValues }: CartCheckoutFormProps) {
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
  const [quotes, setQuotes] = useState<Record<string, { cost: number } | { error: string } | undefined>>({})
  const [useWallet, setUseWallet] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleComunaChange(v: string) {
    set('shipping_comuna', v)
    setQuotes({})
  }

  useEffect(() => {
    if (!form.shipping_comuna) return
    let cancelled = false

    Promise.all(items.map(item =>
      fetch('/api/shipping/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: item.listingId, comuna: form.shipping_comuna }),
      })
        .then(res => res.json().then(data => ({ listingId: item.listingId, ok: res.ok, data })))
        .catch(() => ({ listingId: item.listingId, ok: false, data: { error: 'Error de conexión al cotizar el envío' } }))
    )).then(results => {
      if (cancelled) return
      const next: typeof quotes = {}
      for (const r of results) {
        next[r.listingId] = r.ok ? { cost: r.data.price } : { error: r.data.error || 'No pudimos cotizar el envío' }
      }
      setQuotes(next)
    })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shipping_comuna])

  const quotesReady = form.shipping_comuna !== '' && items.every(i => quotes[i.listingId] !== undefined)
  const quoteErrors = items.map(i => quotes[i.listingId]).filter((q): q is { error: string } => !!q && 'error' in q)
  const shippingTotal = items.reduce((sum, i) => {
    const q = quotes[i.listingId]
    return sum + (q && 'cost' in q ? q.cost : 0)
  }, 0)
  const itemsTotal = items.reduce((sum, i) => sum + i.price + buyerProtectionFee(i.price), 0)
  const total = itemsTotal + shippingTotal
  const promoAmountApplied = Math.min(promoBalance, total)
  const walletAmountApplied = useWallet ? Math.min(walletAvailableBalance, total - promoAmountApplied) : 0
  const amountDue = total - promoAmountApplied - walletAmountApplied

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quotesReady || quoteErrors.length > 0) { setError('Esperá a que se cotice el envío de todas las prendas antes de continuar'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_ids: items.map(i => i.listingId),
          ...form,
          wallet_amount_requested: walletAmountApplied,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al iniciar el pago')
        setLoading(false)
        return
      }
      const expectedCovered = promoAmountApplied + walletAmountApplied
      const actualCovered = (data.promoAmountApplied ?? 0) + (data.walletAmountApplied ?? 0)
      if (expectedCovered > 0 && actualCovered !== expectedCovered) {
        const proceed = confirm(
          `Tu saldo disponible cambió: se aplicaron $${actualCovered.toLocaleString('es-CL')} en vez de los $${expectedCovered.toLocaleString('es-CL')} calculados. ¿Continuar de todas formas?`
        )
        if (!proceed) { setLoading(false); return }
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
        Una sola dirección para todo el carrito — cada vendedora despacha su propio paquete a esta dirección.
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

      {/* Desglose por prenda */}
      <div className="bg-gray-50 p-4 text-xs text-gray-600 space-y-3">
        {items.map(item => {
          const q = quotes[item.listingId]
          return (
            <div key={item.listingId} className="space-y-1 pb-2 border-b border-gray-200 last:border-0 last:pb-0">
              <p className="font-medium text-gray-800 truncate">{item.title}</p>
              <p className="text-[10px] text-gray-400">Vendedora: {item.sellerName}</p>
              <div className="flex justify-between"><span>Prenda</span><span>${item.price.toLocaleString('es-CL')}</span></div>
              <div className="flex justify-between"><span>Protección Comprador</span><span>${buyerProtectionFee(item.price).toLocaleString('es-CL')}</span></div>
              <div className="flex justify-between">
                <span>Envío</span>
                <span>
                  {!form.shipping_comuna ? 'Selecciona tu comuna' :
                    !q ? 'Cotizando...' :
                    'error' in q ? <span className="text-red-500">{q.error}</span> :
                    `$${q.cost.toLocaleString('es-CL')}`}
                </span>
              </div>
            </div>
          )
        })}

        <div className={`flex justify-between border-t border-gray-200 pt-2 mt-1 ${(promoAmountApplied > 0 || walletAmountApplied > 0) ? '' : 'font-medium text-[#5a7a55]'}`}>
          <span>Total ({items.length} {items.length === 1 ? 'prenda' : 'prendas'})</span>
          <span>${total.toLocaleString('es-CL')}</span>
        </div>
        {promoAmountApplied > 0 && (
          <div className="flex justify-between text-[#5a7a55]">
            <span>Crédito B-Dress aplicado</span>
            <span>-${promoAmountApplied.toLocaleString('es-CL')}</span>
          </div>
        )}
        {walletAmountApplied > 0 && (
          <div className="flex justify-between text-[#5a7a55]">
            <span>Saldo B-Dress aplicado</span>
            <span>-${walletAmountApplied.toLocaleString('es-CL')}</span>
          </div>
        )}
        {(promoAmountApplied > 0 || walletAmountApplied > 0) && (
          <div className="flex justify-between font-medium text-[#5a7a55] border-t border-gray-200 pt-1 mt-1">
            <span>{amountDue === 0 ? 'Total a pagar' : 'A pagar con Mercado Pago'}</span>
            <span>${amountDue.toLocaleString('es-CL')}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 text-[10px] text-gray-400">
        <BuyerProtectionModal
          trigger={<span className="underline decoration-dotted underline-offset-2 cursor-pointer hover:text-black">¿Qué es la Protección Comprador?</span>}
          triggerClassName="inline-flex"
        />
      </div>

      {promoAmountApplied > 0 && (
        <p className="text-[10px] text-gray-400 -mt-2">
          Tu Crédito B-Dress (${promoBalance.toLocaleString('es-CL')} disponible) se aplica automáticamente — es promocional, no transferible.
        </p>
      )}

      {walletAvailableBalance > 0 && (
        <label className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-3 cursor-pointer">
          <input type="checkbox" checked={useWallet} onChange={e => setUseWallet(e.target.checked)} />
          Usar mi saldo B-Dress (${walletAvailableBalance.toLocaleString('es-CL')} disponible)
        </label>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button type="submit" disabled={loading || !quotesReady || quoteErrors.length > 0}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 hover:bg-[#6f9678] transition disabled:opacity-50">
        {loading ? 'Procesando...' : amountDue === 0 ? 'Confirmar compra' : 'Continuar al pago'}
      </button>
      <p className="text-[10px] text-gray-400 text-center">
        {amountDue === 0
          ? 'Se paga con tu saldo B-Dress · Bdress retiene hasta confirmar recepción'
          : 'Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción'}
      </p>
    </form>
  )
}
