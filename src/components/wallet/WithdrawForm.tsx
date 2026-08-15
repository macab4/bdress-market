'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BankAccount } from '@/types'
import { accountTypeLabel, maskAccountNumber } from '@/lib/bankAccounts'

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

export default function WithdrawForm({ availableBalance, bankAccounts }: { availableBalance: number; bankAccounts: BankAccount[] }) {
  const router = useRouter()
  const [amountMode, setAmountMode] = useState<'all' | 'custom'>('all')
  const [customAmount, setCustomAmount] = useState('')
  const [bankAccountId, setBankAccountId] = useState(bankAccounts[0]?.id ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const amount = amountMode === 'all' ? availableBalance : Math.round(Number(customAmount) || 0)
  const amountValid = amount > 0 && amount <= availableBalance

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amountValid || !bankAccountId) return
    setSending(true)
    setError('')

    const res = await fetch('/api/wallet/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankAccountId,
        useFullBalance: amountMode === 'all',
        amount: amountMode === 'custom' ? amount : undefined,
      }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al solicitar el retiro')
      setSending(false)
      return
    }

    router.push('/dashboard/wallet')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-5">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Tu saldo transferible</p>
        <p className="text-2xl font-light">{formatCLP(availableBalance)}</p>
      </div>

      <div className="bg-white p-5 space-y-3">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">¿Cuánto deseas transferir?</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" checked={amountMode === 'all'} onChange={() => setAmountMode('all')} />
          Transferir todo mi saldo — {formatCLP(availableBalance)}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" checked={amountMode === 'custom'} onChange={() => setAmountMode('custom')} />
          Elegir monto
        </label>
        {amountMode === 'custom' && (
          <input
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
            type="number"
            min={1}
            max={availableBalance}
            placeholder="Monto en CLP"
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
        )}
        {amountMode === 'custom' && customAmount && !amountValid && (
          <p className="text-red-500 text-xs">El monto debe ser mayor a $0 y no superar tu saldo disponible.</p>
        )}
      </div>

      <div className="bg-white p-5 space-y-3">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">Selecciona la cuenta para transferir</p>
        {bankAccounts.map(acc => (
          <label key={acc.id} className="flex items-center gap-3 text-sm cursor-pointer border border-gray-100 px-3 py-2.5">
            <input type="radio" checked={bankAccountId === acc.id} onChange={() => setBankAccountId(acc.id)} />
            <span>
              {acc.bank} · {accountTypeLabel(acc.account_type)} {maskAccountNumber(acc.account_number)}
            </span>
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={sending || !amountValid || !bankAccountId}
        className="w-full bg-black text-white text-xs tracking-widest uppercase py-3 hover:bg-gray-800 transition disabled:opacity-50"
      >
        {sending ? 'Enviando...' : 'Solicitar transferencia'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  )
}
