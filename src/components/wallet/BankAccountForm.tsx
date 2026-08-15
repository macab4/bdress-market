'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CHILEAN_BANKS, ACCOUNT_TYPES } from '@/lib/bankAccounts'
import type { BankAccountType } from '@/types'

// Insert directo vía cliente (RLS: auth.uid() = user_id) — mismo patrón que
// FavoriteButton. bank_accounts no mueve dinero, solo es dato de
// referencia, así que no necesita pasar por un endpoint server.
export default function BankAccountForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState<string>(CHILEAN_BANKS[0])
  const [accountType, setAccountType] = useState<BankAccountType>('checking')
  const [accountNumber, setAccountNumber] = useState('')
  const [holderRut, setHolderRut] = useState('')
  const [holderName, setHolderName] = useState('')
  const [holderEmail, setHolderEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sin sesión'); setSending(false); return }

    const { error: insertError } = await supabase.from('bank_accounts').insert({
      user_id: user.id,
      bank,
      account_type: accountType,
      account_number: accountNumber.trim(),
      holder_rut: holderRut.trim(),
      holder_name: holderName.trim(),
      holder_email: holderEmail.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
      setSending(false)
      return
    }

    setOpen(false)
    setAccountNumber('')
    setHolderRut('')
    setHolderName('')
    setHolderEmail('')
    setSending(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-[10px] tracking-widest uppercase text-white bg-black px-4 py-3 hover:bg-gray-800 transition"
      >
        + Agregar cuenta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">Agregar cuenta bancaria</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-black">
          Cancelar
        </button>
      </div>
      <select
        value={bank}
        onChange={e => setBank(e.target.value)}
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400 bg-white"
      >
        {CHILEAN_BANKS.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
      <select
        value={accountType}
        onChange={e => setAccountType(e.target.value as BankAccountType)}
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400 bg-white"
      >
        {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input
        value={accountNumber}
        onChange={e => setAccountNumber(e.target.value)}
        placeholder="Número de cuenta"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <input
        value={holderRut}
        onChange={e => setHolderRut(e.target.value)}
        placeholder="RUT del titular"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <input
        value={holderName}
        onChange={e => setHolderName(e.target.value)}
        placeholder="Nombre del titular"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <input
        value={holderEmail}
        onChange={e => setHolderEmail(e.target.value)}
        type="email"
        placeholder="Email (opcional)"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <button
        type="submit"
        disabled={sending || !accountNumber.trim() || !holderRut.trim() || !holderName.trim()}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {sending ? 'Guardando...' : 'Guardar cuenta'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </form>
  )
}
