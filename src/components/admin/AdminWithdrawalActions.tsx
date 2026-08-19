'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminWithdrawalActions({ withdrawalId, status }: { withdrawalId: string; status: 'pending' | 'processing' }) {
  const router = useRouter()
  const [operationNumber, setOperationNumber] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [internalNote, setInternalNote] = useState('')
  const [sending, setSending] = useState<'processing' | 'completed' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  async function sendAction(action: 'processing' | 'completed' | 'rejected') {
    setSending(action)
    setError('')

    const formData = new FormData()
    formData.set('action', action)
    if (operationNumber.trim()) formData.set('operationNumber', operationNumber.trim())
    if (internalNote.trim()) formData.set('internalNote', internalNote.trim())
    if (receiptFile) formData.set('receiptFile', receiptFile)

    const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/status`, {
      method: 'POST',
      body: formData,
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al actualizar el retiro')
      setSending(null)
      return
    }

    router.refresh()
    setSending(null)
  }

  return (
    <div className="bg-white p-5 space-y-4">
      <p className="text-[10px] tracking-widest uppercase text-gray-400">Acciones</p>

      <div className="space-y-2">
        <input
          value={operationNumber}
          onChange={e => setOperationNumber(e.target.value)}
          placeholder="N.º de operación (opcional)"
          className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
        />
        <div>
          <label className="block text-[10px] text-gray-400 mb-1">Comprobante de transferencia (opcional) — se le manda por correo a la usuaria</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs file:mr-2 file:border-0 file:bg-gray-100 file:px-2 file:py-1.5 file:text-[10px] file:tracking-widest file:uppercase"
          />
        </div>
        <textarea
          value={internalNote}
          onChange={e => setInternalNote(e.target.value)}
          placeholder="Nota interna (opcional)"
          rows={2}
          className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400 resize-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {status === 'pending' && (
          <button
            onClick={() => sendAction('processing')}
            disabled={sending !== null}
            className="text-[10px] tracking-widest uppercase text-white bg-blue-600 px-3 py-2 hover:bg-blue-700 transition disabled:opacity-50"
          >
            {sending === 'processing' ? 'Aplicando...' : 'Marcar como procesando'}
          </button>
        )}
        <button
          onClick={() => sendAction('completed')}
          disabled={sending !== null}
          className="text-[10px] tracking-widest uppercase text-white bg-[#7fab87] px-3 py-2 hover:bg-[#6f9678] transition disabled:opacity-50"
        >
          {sending === 'completed' ? 'Aplicando...' : 'Marcar como transferido'}
        </button>
        <button
          onClick={() => sendAction('rejected')}
          disabled={sending !== null}
          className="text-[10px] tracking-widest uppercase text-white bg-red-500 px-3 py-2 hover:bg-red-600 transition disabled:opacity-50"
        >
          {sending === 'rejected' ? 'Aplicando...' : 'Rechazar'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  )
}
