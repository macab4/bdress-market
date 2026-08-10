'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadLabelForm({ orderId, sellerEmail }: { orderId: string; sellerEmail: string | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Elige un archivo primero'); return }

    setLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`/api/admin/orders/${orderId}/label`, { method: 'POST', body: formData })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al subir la etiqueta')
      setLoading(false)
      return
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="block w-full text-xs text-gray-500 file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-xs file:tracking-widest file:uppercase"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {loading ? 'Enviando...' : 'Enviar etiqueta a la vendedora'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {sellerEmail && (
        <p className="text-[10px] text-gray-400">Se enviará por correo a {sellerEmail}</p>
      )}
    </form>
  )
}
