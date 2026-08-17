import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-auth'
import AdminNav from '@/components/admin/AdminNav'
import WalletSubNav from '@/components/admin/WalletSubNav'

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

type AccountRow = {
  user_id: string
  available_balance: number
  pending_balance: number
  reserved_balance: number
  promo_balance: number
  user: { name: string; email: string } | null
}

// Vista que faltaba: /admin/wallet solo mostraba totales agregados y un log
// de movimientos (una fila por transacción), pero ningún lugar respondía
// "¿cuánta plata tiene ahora mismo cada usuaria?" sin sumar a mano o entrar
// una por una a /admin/users/[id]. Acá se agrega saldo actual por
// usuaria + si tiene cuenta bancaria registrada (indica si puede pedir
// retiro) — para que la admin sepa cuánta plata real debe tener en caja.
export default async function AdminWalletBalancesPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const [{ data: accounts }, { data: bankAccounts }, { data: openWithdrawals }] = await Promise.all([
    admin
      .from('wallet_accounts')
      .select('user_id, available_balance, pending_balance, reserved_balance, promo_balance, user:profiles!wallet_accounts_user_id_fkey(name, email)')
      .order('available_balance', { ascending: false }) as unknown as Promise<{ data: AccountRow[] | null }>,
    admin.from('bank_accounts').select('user_id').eq('is_active', true),
    admin.from('withdrawals').select('user_id').in('status', ['pending', 'processing']),
  ])

  const withBank = new Set((bankAccounts ?? []).map(b => b.user_id))
  const withOpenWithdrawal = new Set((openWithdrawals ?? []).map(w => w.user_id))

  const rows = (accounts ?? [])
    .filter(a => a.available_balance > 0 || a.pending_balance > 0 || a.reserved_balance > 0 || a.promo_balance > 0)
    .sort((a, b) =>
      (b.available_balance + b.pending_balance + b.reserved_balance) -
      (a.available_balance + a.pending_balance + a.reserved_balance)
    )

  const totalCash = rows.reduce((sum, a) => sum + a.available_balance + a.pending_balance + a.reserved_balance, 0)
  const totalPromo = rows.reduce((sum, a) => sum + a.promo_balance, 0)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/wallet" />
        </div>

        <WalletSubNav active="usuarias" />

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white p-5">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Plata real que debes tener en caja</p>
            <p className="text-xl font-light">{formatCLP(totalCash)}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">Disponible + pendiente de liberar + reservado, todas las usuarias</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Crédito B-Dress emitido</p>
            <p className="text-xl font-light text-[#7fab87]">{formatCLP(totalPromo)}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">No es dinero real — no transferible ni retirable</p>
          </div>
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Usuarias con saldo ({rows.length})
        </h2>

        <div className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                <th className="text-left px-4 py-3">Usuaria</th>
                <th className="text-right px-4 py-3">Disponible</th>
                <th className="text-right px-4 py-3">Pendiente</th>
                <th className="text-right px-4 py-3">Reservado</th>
                <th className="text-right px-4 py-3">Crédito B-Dress</th>
                <th className="text-left px-4 py-3">Cuenta bancaria</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.user_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="truncate">{a.user?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{a.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(a.available_balance)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatCLP(a.pending_balance)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">{formatCLP(a.reserved_balance)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#5a7a55]">{formatCLP(a.promo_balance)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {withOpenWithdrawal.has(a.user_id) ? (
                      <span className="text-amber-600">Retiro en curso</span>
                    ) : withBank.has(a.user_id) ? (
                      <span className="text-gray-500">Registrada</span>
                    ) : (
                      <span className="text-gray-300">Sin registrar</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/admin/users/${a.user_id}`} className="text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">Ninguna usuaria tiene saldo actualmente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
