'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type AnalyzeState = 'idle' | 'analyzing' | 'done'

export default function UploadLabelForm({ orderId, sellerEmail }: { orderId: string; sellerEmail: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>('idle')
  const [detectedFromFile, setDetectedFromFile] = useState(false)
  const [courier, setCourier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange() {
    const file = fileRef.current?.files?.[0]
    setCourier('')
    setTrackingNumber('')
    setNotice('')
    setError('')
    setDetectedFromFile(false)
    if (!file) { setAnalyzeState('idle'); return }

    setAnalyzeState('analyzing')
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/admin/orders/${orderId}/label/analyze`, { method: 'POST', body: formData })
    const data = await res.json().catch(() => ({}))
    setAnalyzeState('done')

    if (!res.ok) {
      setNotice('No se pudo analizar el archivo — completa transportista y seguimiento a mano.')
      return
    }
    if (data.carrierLabel && data.trackingNumber) {
      setCourier(data.carrierLabel)
      setTrackingNumber(data.trackingNumber)
      setDetectedFromFile(true)
      setNotice(`Detectado automáticamente: ${data.carrierLabel}. Revisa que el N.º de seguimiento sea correcto antes de enviar.`)
    } else if (data.carrierLabel) {
      setCourier(data.carrierLabel)
      setNotice(`Se detectó el transportista (${data.carrierLabel}) pero no el número de seguimiento con certeza — complétalo a mano.`)
    } else if (data.reason === 'not_pdf') {
      setNotice('Solo se puede detectar automáticamente desde un PDF — sube el PDF de Chilexpress, o completa transportista y seguimiento a mano.')
    } else {
      setNotice('No se pudo detectar transportista ni número de seguimiento automáticamente — complétalos a mano antes de enviar.')
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Elige un archivo primero'); return }
    if (!courier.trim() || !trackingNumber.trim()) {
      setError('Completa transportista y número de seguimiento antes de enviar')
      return
    }

    setSending(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('courier', courier.trim())
    formData.append('trackingNumber', trackingNumber.trim())

    const res = await fetch(`/api/admin/orders/${orderId}/label`, { method: 'POST', body: formData })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al subir la etiqueta')
      setSending(false)
      return
    }

    router.refresh()
    setSending(false)
  }

  return (
    <form onSubmit={handleSend} className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={handleFileChange}
        className="block w-full text-xs text-gray-500 file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:tracking-widest file:uppercase"
      />

      {analyzeState === 'analyzing' && (
        <p className="text-[10px] text-gray-400">Analizando archivo...</p>
      )}

      {analyzeState === 'done' && (
        <div className="space-y-2 border-t border-gray-100 pt-2">
          {notice && (
            <p className={`text-[10px] ${detectedFromFile ? 'text-[#5a7a55]' : 'text-amber-600'}`}>{notice}</p>
          )}
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Transportista</label>
            <input
              value={courier}
              onChange={e => setCourier(e.target.value)}
              placeholder="Ej. Chilexpress"
              className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">N.º de seguimiento</label>
            <input
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder="Ej. 696731298071"
              className="w-full border border-gray-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={sending || analyzeState !== 'done'}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {sending ? 'Enviando...' : 'Enviar etiqueta a la vendedora'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {sellerEmail && (
        <p className="text-[10px] text-gray-400">Se enviará por correo a {sellerEmail} (y aviso a la compradora)</p>
      )}
    </form>
  )
}
