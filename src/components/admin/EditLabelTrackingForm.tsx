'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type DetectState = 'detecting' | 'detected' | 'not_detected'

export default function EditLabelTrackingForm({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [detectState, setDetectState] = useState<DetectState>('detecting')
  const [detectedFromFile, setDetectedFromFile] = useState(false)
  const [notice, setNotice] = useState('')
  const [courier, setCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function detect() {
      const res = await fetch(`/api/admin/orders/${orderId}/label/detect`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (cancelled) return

      if (!res.ok) {
        setDetectState('not_detected')
        setNotice('No se pudo leer la etiqueta — completa transportista y seguimiento a mano.')
        return
      }
      if (data.carrierLabel && data.trackingNumber) {
        setCourier(data.carrierLabel)
        setTrackingNumber(data.trackingNumber)
        setDetectedFromFile(true)
        setDetectState('detected')
        setNotice(`Detectado automáticamente desde la etiqueta: ${data.carrierLabel}. Revisa que el N.º de seguimiento sea correcto antes de guardar.`)
      } else if (data.carrierLabel) {
        setCourier(data.carrierLabel)
        setDetectState('not_detected')
        setNotice(`Se detectó el transportista (${data.carrierLabel}) pero no el número de seguimiento con certeza — complétalo a mano.`)
      } else if (data.reason === 'not_pdf') {
        setDetectState('not_detected')
        setNotice('La etiqueta subida no es un PDF — no se puede detectar automáticamente, completa a mano.')
      } else {
        setDetectState('not_detected')
        setNotice('No se pudo detectar transportista ni número de seguimiento automáticamente — complétalos a mano.')
      }
    }
    detect()
    return () => { cancelled = true }
  }, [orderId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!courier.trim() || !trackingNumber.trim()) {
      setError('Completa transportista y número de seguimiento')
      return
    }

    setSending(true)
    setError('')

    const res = await fetch(`/api/admin/orders/${orderId}/label/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courier: courier.trim(), trackingNumber: trackingNumber.trim() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al guardar')
      setSending(false)
      return
    }

    router.refresh()
    setSending(false)
  }

  return (
    <form onSubmit={handleSend} className="bg-amber-50 p-3 space-y-2">
      <p className="text-[10px] text-amber-700">
        Esta orden tiene una etiqueta subida pero le falta el transportista/N.º de seguimiento.
      </p>
      {detectState === 'detecting' && (
        <p className="text-[10px] text-amber-600">Leyendo la etiqueta para detectarlo automáticamente...</p>
      )}
      {notice && detectState !== 'detecting' && (
        <p className={`text-[10px] ${detectedFromFile ? 'text-[#5a7a55]' : 'text-amber-600'}`}>{notice}</p>
      )}
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
        {sending ? 'Guardando...' : 'Guardar'}
      </button>
      {error && <p className="text-red-500 text-[10px]">{error}</p>}
    </form>
  )
}
