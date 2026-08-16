'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Etiqueta de devolución — mismo patrón que UploadLabelForm (etiqueta de
// ida a la vendedora), pero acá la sube la admin para que la compradora
// devuelva la prenda. Sin la detección automática por análisis de archivo
// que sí tiene la de ida (no vale la pena duplicar ese endpoint para un
// caso mucho menos frecuente) — transportista y seguimiento se ingresan a mano.
export default function UploadReturnLabelForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [courier, setCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Falta el archivo de la etiqueta'); return }
    if (!courier.trim() || !trackingNumber.trim()) { setError('Completa transportista y número de seguimiento'); return }

    setSending(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('courier', courier.trim())
    formData.append('trackingNumber', trackingNumber.trim())

    const res = await fetch(`/api/admin/orders/${orderId}/return-label`, { method: 'POST', body: formData })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al subir la etiqueta de devolución')
      setSending(false)
      return
    }

    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Devolución aprobada — sube la etiqueta para que la compradora devuelva la prenda (dirección invertida: retiro donde ella, entrega donde la vendedora).
      </p>
      <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className="text-xs" />
      <div className="flex gap-2">
        <input
          value={courier}
          onChange={e => setCourier(e.target.value)}
          placeholder="Transportista, ej. Chilexpress"
          className="flex-1 border border-amber-200 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-amber-400"
        />
        <input
          value={trackingNumber}
          onChange={e => setTrackingNumber(e.target.value)}
          placeholder="N.º de seguimiento"
          className="flex-1 border border-amber-200 px-2 py-1.5 text-xs font-mono bg-white focus:outline-none focus:border-amber-400"
        />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="text-[10px] tracking-widest uppercase text-white bg-amber-600 px-3 py-1.5 hover:bg-amber-700 transition disabled:opacity-50"
      >
        {sending ? 'Enviando...' : 'Enviar etiqueta a la compradora'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </form>
  )
}
