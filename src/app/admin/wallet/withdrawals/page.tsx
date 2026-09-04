import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-auth'
import { Withdrawal, WithdrawalStatus } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import WalletSubNav from '@/components/admin/WalletSubNav'
import { accountTypeLabel, maskAccountNumber } from '@/lib/bankAccounts'

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Transferido',
  rejected: 'Rechazado',
}

const STATUS_COLORS: Record<WithdrawalStatus, string> = {
  pending: 'bg-amber-50 text-amber-600',
  processing: 'bg-blue-50 text-blue-600',
  completed: 'bg-[#7fab87]/10 text-[#5a7a55]',
  rejected: 'bg-red-50 text-red-600',
}

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdminUser()
  const { status } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('withdrawals')
    .select('*, user:profiles!withdrawals_user_id_fkey(name, email)')
    .order('requested_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data: withdrawals } = await query as unknown as { data: Withdrawal[] | null }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/wallet" />
        </div>

        <WalletSubNav active="retiros" />

        <div className="flex gap-4 mb-6">
          <Link href="/admin/wallet/withdrawals" className={`text-[10px] tracking-widest uppercase pb-1 ${!status ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}>Todos</Link>
          {(['pending', 'processing', 'completed', 'rejected'] as const).map(s => (
            <Link key={s} href={`/admin/wallet/withdrawals?status=${s}`} className={`text-[10px] tracking-widest uppercase pb-1 ${status === s ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}>
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>

        <div className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                <th className="text-left px-4 py-3">Usuaria</th>
                <th className="text-right px-4 py-3">Monto</th>
                <th className="text-left px-4 py-3">Banco</th>
                <th className="text-left px-4 py-3">Cuenta</th>
                <th className="text-left px-4 py-3">Fecha solicitud</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(withdrawals ?? []).map(w => (
                <tr key={w.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="truncate">{w.user?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{w.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(w.amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{w.bank}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{accountTypeLabel(w.account_type)} {maskAccountNumber(w.account_number)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(w.requested_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${STATUS_COLORS[w.status]}`}>{STATUS_LABELS[w.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/wallet/withdrawals/${w.id}`} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
              {(!withdrawals || withdrawals.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No hay retiros{status ? ` con estado "${STATUS_LABELS[status as WithdrawalStatus]}"` : ''}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
