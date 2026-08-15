'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BankAccount } from '@/types'
import { accountTypeLabel, maskAccountNumber } from '@/lib/bankAccounts'

// Update/delete directo vía cliente (RLS: auth.uid() = user_id) — mismo
// patrón que FavoriteButton.
export default function BankAccountRow({ account }: { account: BankAccount }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggleActive() {
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('bank_accounts')
      .update({ is_active: !account.is_active, updated_at: new Date().toISOString() })
      .eq('id', account.id)
    if (updateError) { setError(updateError.message); setBusy(false); return }
    router.refresh()
  }

  async function remove() {
    if (!confirm('¿Eliminar esta cuenta bancaria?')) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: deleteError } = await supabase.from('bank_accounts').delete().eq('id', account.id)
    if (deleteError) { setError(deleteError.message); setBusy(false); return }
    router.refresh()
  }

  return (
    <div className={`bg-white p-4 ${!account.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{account.bank}</p>
          <p className="text-xs text-gray-500">{accountTypeLabel(account.account_type)} {maskAccountNumber(account.account_number)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{account.holder_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button onClick={toggleActive} disabled={busy} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50">
            {account.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={remove} disabled={busy} className="text-[10px] tracking-widest uppercase text-red-400 hover:text-red-600 disabled:opacity-50">
            Eliminar
          </button>
        </div>
      </div>
      {error && <p className="text-red-500 text-[10px] mt-2">{error}</p>}
    </div>
  )
}
