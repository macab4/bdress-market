'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALLOWED_TRANSITIONS, InternationalStatusAction } from '@/lib/international/status'
import { InternationalStatus } from '@/types'

interface ActionDef {
  action: InternationalStatusAction
  label: string
  sensitive?: boolean
  buildPayload?: () => Record<string, unknown> | null // null = usuaria canceló
}

const TRANSITION_LABELS: Record<InternationalStatusAction, string> = {
  confirm_availability: 'Confirmar disponibilidad y continuar',
  register_external_purchase: 'Registrar compra en Vinted',
  mark_received_spain: 'Marcar recibido en España',
  mark_in_transit: 'Marcar en tránsito internacional',
  mark_customs: 'Marcar en trámite aduanero',
  mark_received_chile: 'Marcar recibido en Chile',
  approve_quality_check: 'Marcar revisión aprobada',
  prepare_national_shipping: 'Preparar despacho nacional',
  mark_nationally_shipped: 'Marcar despachado en Chile',
  mark_delivered: 'Marcar entregado',
  mark_unavailable: 'Producto agotado en origen',
  start_cancellation: 'Iniciar cancelación',
  begin_refund: 'Iniciar reembolso',
  confirm_refund: 'Confirmar reembolso realizado',
}

function buildPayloadFor(action: InternationalStatusAction): Record<string, unknown> | null {
  if (action === 'register_external_purchase') {
    const ref = prompt('Referencia de la orden en Vinted:')
    if (ref === null) return null
    const priceStr = prompt('Costo real de compra (CLP):')
    if (priceStr === null) return null
    return {
      external_order_reference: ref,
      external_purchase_price: Number(priceStr) || null,
      external_purchase_currency: 'CLP',
      external_purchase_date: new Date().toISOString().slice(0, 10),
    }
  }
  if (action === 'mark_unavailable') {
    if (!confirm('¿Confirmas que la prenda ya no está disponible en la plataforma de origen? Esto anula la orden e inicia el reembolso.')) return null
    return { confirm: true }
  }
  if (action === 'confirm_refund') {
    if (!confirm('¿Confirmas que Mercado Pago ya procesó el reembolso completo? Esta acción no se puede deshacer.')) return null
    return { confirm: true }
  }
  return {}
}

export default function InternationalOrderActions({ orderId, currentStatus }: { orderId: string; currentStatus: InternationalStatus }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const available: ActionDef[] = (Object.keys(ALLOWED_TRANSITIONS) as InternationalStatusAction[])
    .filter(action => ALLOWED_TRANSITIONS[action].from.includes(currentStatus) && action !== 'mark_nationally_shipped')
    .map(action => ({ action, label: TRANSITION_LABELS[action], buildPayload: () => buildPayloadFor(action) }))

  async function runAction(action: InternationalStatusAction | 'add_internal_note' | 'add_public_update', payload: Record<string, unknown>) {
    setLoading(true)
    const res = await fetch(`/api/admin/international/orders/${orderId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Error al aplicar la acción')
    }
    router.refresh()
    setLoading(false)
  }

  async function addNote(kind: 'add_internal_note' | 'add_public_update') {
    const note = prompt(kind === 'add_internal_note' ? 'Nota interna:' : 'Actualización visible para la clienta:')
    if (!note) return
    await runAction(kind, { note })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {available.map(def => (
        <button
          key={def.action}
          disabled={loading}
          onClick={() => {
            const payload = def.buildPayload ? def.buildPayload() : {}
            if (payload === null) return
            runAction(def.action, payload)
          }}
          className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50"
        >
          {def.label}
        </button>
      ))}
      <button disabled={loading} onClick={() => addNote('add_public_update')} className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black disabled:opacity-50">
        + Actualización pública
      </button>
      <button disabled={loading} onClick={() => addNote('add_internal_note')} className="text-[10px] tracking-widest uppercase text-gray-300 hover:text-black disabled:opacity-50">
        + Nota interna
      </button>
    </div>
  )
}
