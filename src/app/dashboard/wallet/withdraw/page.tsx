import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BankAccount, WalletAccount, Withdrawal } from '@/types'
import WithdrawForm from '@/components/wallet/WithdrawForm'

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

export default async function WithdrawPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: account }, { data: bankAccounts }, { data: activeWithdrawal }] = await Promise.all([
    supabase.from('wallet_accounts').select('*').eq('user_id', user.id).maybeSingle() as unknown as Promise<{ data: WalletAccount | null }>,
    supabase.from('bank_accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }) as unknown as Promise<{ data: BankAccount[] | null }>,
    supabase.from('withdrawals').select('*').eq('user_id', user.id).in('status', ['pending', 'processing']).maybeSingle() as unknown as Promise<{ data: Withdrawal | null }>,
  ])

  const availableBalance = account?.available_balance ?? 0

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">
          <Link href="/dashboard/wallet" className="hover:text-black">Mi saldo</Link> · Transferir
        </p>
        <h1 className="text-xl font-light tracking-widest uppercase">Transferir saldo</h1>

        {activeWithdrawal ? (
          <div className="bg-white p-5 text-sm text-gray-600">
            Ya tienes un retiro de <strong>{formatCLP(activeWithdrawal.amount)}</strong> en curso — espera a que se resuelva antes de solicitar otro.
          </div>
        ) : availableBalance <= 0 ? (
          <div className="bg-white p-5 text-sm text-gray-600">
            No tienes saldo disponible para transferir todavía.
          </div>
        ) : (bankAccounts?.length ?? 0) === 0 ? (
          <div className="bg-white p-5 text-sm text-gray-600 space-y-3">
            <p>Todavía no tienes una cuenta bancaria guardada.</p>
            <Link href="/dashboard/wallet/bank-accounts" className="inline-block text-[10px] tracking-widest uppercase text-white bg-black px-4 py-2.5 hover:bg-gray-800 transition">
              Agregar cuenta bancaria
            </Link>
          </div>
        ) : (
          <WithdrawForm availableBalance={availableBalance} bankAccounts={bankAccounts ?? []} />
        )}
      </div>
    </div>
  )
}
