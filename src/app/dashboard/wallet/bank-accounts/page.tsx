import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BankAccount } from '@/types'
import BankAccountForm from '@/components/wallet/BankAccountForm'
import BankAccountRow from '@/components/wallet/BankAccountRow'

export default async function BankAccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: bankAccounts } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: BankAccount[] | null }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">
          <Link href="/dashboard/wallet" className="hover:text-black">Mi saldo</Link> · Mis cuentas bancarias
        </p>
        <h1 className="text-xl font-light tracking-widest uppercase">Mis cuentas bancarias</h1>

        <div className="space-y-2">
          {(bankAccounts ?? []).map(acc => (
            <BankAccountRow key={acc.id} account={acc} />
          ))}
          {(bankAccounts?.length ?? 0) === 0 && (
            <p className="text-sm text-gray-400 bg-white p-5 text-center">Todavía no tienes cuentas bancarias guardadas.</p>
          )}
        </div>

        <BankAccountForm />
      </div>
    </div>
  )
}
