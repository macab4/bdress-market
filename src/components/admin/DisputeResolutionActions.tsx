'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DisputeResolutionActions({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'refund' | 'release' | 'partial_credit' | 'approve_return' | null>(null)
  const [error, setError] = useState('')

  async function resolve(action: 'refund' | 'release', amount?: number) {
    const confirmMsg = action === 'refund'
      ? '¿Reembolsar a la compradora y cancelar esta venta? Úsalo solo si no hay nada físico que devolver (ej. nunca se despachó).'
      : '¿Liberar el pago a la vendedora? Se marca la orden como completada.'
    if (!confirm(confirmMsg)) return
    await submit(action, amount)
  }

  async function resolvePartialCredit() {
    const input = prompt('¿Cuántos pesos de Crédito B-Dress le damos a la compradora? Se descuentan del pago de la vendedora.')
    if (!input) return
    const amount = Number(input.replace(/\D/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) { setError('Monto inválido'); return }
    if (!confirm(`¿Compensar a la compradora con $${amount.toLocaleString('es-CL')} de Crédito B-Dress, descontado del pago de la vendedora? La venta se mantiene y se marca como completada.`)) return
    await submit('partial_credit', amount)
  }

  async function submit(action: 'refund' | 'release' | 'partial_credit', amount?: number) {
    setLoading(action)
    setError('')
    const res = await fetch(`/api/admin/orders/${orderId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...(amount ? { amount } : {}) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al resolver la disputa')
      setLoading(null)
      return
    }
    router.refresh()
  }

  async function approveReturn() {
    if (!confirm('¿Aprobar la devolución? La compradora tiene la prenda — el reembolso queda retenido hasta que confirmes que la vendedora la recibió de vuelta (desde el detalle de la orden).')) return
    setLoading('approve_return')
    setError('')
    const res = await fetch(`/api/admin/orders/${orderId}/approve-return`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al aprobar la devolución')
      setLoading(null)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => resolve('refund')} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase bg-red-500 text-white px-4 py-2 hover:bg-red-600 transition disabled:opacity-50">
          {loading === 'refund' ? 'Reembolsando...' : 'Reembolsar sin devolución'}
        </button>
        <button onClick={approveReturn} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase bg-amber-600 text-white px-4 py-2 hover:bg-amber-700 transition disabled:opacity-50">
          {loading === 'approve_return' ? 'Aprobando...' : 'Aprobar devolución'}
        </button>
        <button onClick={() => resolve('release')} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase bg-[#7fab87] text-white px-4 py-2 hover:bg-[#6f9678] transition disabled:opacity-50">
          {loading === 'release' ? 'Liberando...' : 'Liberar pago a vendedora'}
        </button>
        <button onClick={resolvePartialCredit} disabled={loading !== null}
          className="text-[10px] tracking-widest uppercase border border-gray-300 text-gray-700 px-4 py-2 hover:border-black hover:text-black transition disabled:opacity-50">
          {loading === 'partial_credit' ? 'Compensando...' : 'Compensar parcialmente'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
