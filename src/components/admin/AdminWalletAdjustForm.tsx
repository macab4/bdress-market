'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminWalletAdjustForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [type, setType] = useState<'admin_credit' | 'admin_debit'>('admin_credit')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/wallet/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), type, amount: Number(amount), reason: reason.trim() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al ajustar el saldo')
      setSending(false)
      return
    }

    setSuccess(`Ajuste aplicado a ${email.trim()}`)
    setEmail('')
    setAmount('')
    setReason('')
    setSending(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] tracking-widest uppercase text-white bg-black px-3 py-2 hover:bg-gray-800 transition"
      >
        + Ajuste de saldo
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 space-y-3 mb-2 max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">Ajuste de saldo</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-black">
          Cancelar
        </button>
      </div>
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        placeholder="Email de la usuaria"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={e => setType(e.target.value as 'admin_credit' | 'admin_debit')}
          className="border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="admin_credit">Crédito (+)</option>
          <option value="admin_debit">Débito (−)</option>
        </select>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          type="number"
          min="1"
          placeholder="Monto CLP"
          className="flex-1 border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
        />
      </div>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo (obligatorio)"
        rows={2}
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400 resize-none"
      />
      <button
        type="submit"
        disabled={sending || !email.trim() || !amount || !reason.trim()}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {sending ? 'Aplicando...' : 'Aplicar ajuste'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {success && <p className="text-[#5a7a55] text-xs">{success}</p>}
    </form>
  )
}
