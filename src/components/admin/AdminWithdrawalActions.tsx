'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminWithdrawalActions({ withdrawalId, status }: { withdrawalId: string; status: 'pending' | 'processing' }) {
  const router = useRouter()
  const [operationNumber, setOperationNumber] = useState('')
  const [receiptUrl, setReceiptUrl] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [sending, setSending] = useState<'processing' | 'completed' | 'rejected' | null>(null)
  const [error, setError] = useState('')

  async function sendAction(action: 'processing' | 'completed' | 'rejected') {
    setSending(action)
    setError('')

    const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, operationNumber: operationNumber.trim() || undefined, receiptUrl: receiptUrl.trim() || undefined, internalNote: internalNote.trim() || undefined }),
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
        <input
          value={receiptUrl}
          onChange={e => setReceiptUrl(e.target.value)}
          placeholder="Link a comprobante (opcional)"
          className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
        />
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
