import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-auth'
import { WalletTransaction, WalletTransactionType } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import AdminWalletAdjustForm from '@/components/admin/AdminWalletAdjustForm'
import WalletSubNav from '@/components/admin/WalletSubNav'

const TYPE_LABELS: Record<WalletTransactionType, string> = {
  sale_pending: 'Venta pendiente',
  sale_release: 'Venta liberada',
  sale_reversal: 'Reverso de venta',
  withdrawal_hold: 'Retiro solicitado',
  withdrawal_completed: 'Retiro completado',
  withdrawal_cancelled: 'Retiro cancelado',
  marketplace_purchase: 'Compra con saldo',
  marketplace_purchase_refund: 'Reembolso de compra',
  giftcard_redemption: 'Gift Card',
  admin_credit: 'Ajuste — crédito',
  admin_debit: 'Ajuste — débito',
}

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

type TxWithRelations = WalletTransaction & {
  user: { name: string; email: string } | null
  listing: { title: string } | null
}

export default async function AdminWalletPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const [{ data: accounts }, { data: movements }] = await Promise.all([
    admin.from('wallet_accounts').select('available_balance, pending_balance, reserved_balance'),
    admin
      .from('wallet_transactions')
      .select('*, user:profiles!wallet_transactions_user_id_fkey(name, email), listing:listings(title)')
      .order('created_at', { ascending: false })
      .limit(100) as unknown as Promise<{ data: TxWithRelations[] | null }>,
  ])

  const totals = (accounts ?? []).reduce(
    (acc, a) => ({
      available: acc.available + a.available_balance,
      pending: acc.pending + a.pending_balance,
      reserved: acc.reserved + a.reserved_balance,
    }),
    { available: 0, pending: 0, reserved: 0 }
  )

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/wallet" />
        </div>

        <WalletSubNav active="movimientos" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Disponible (todas)</p>
            <p className="text-xl font-light">{formatCLP(totals.available)}</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Pendiente de liberar</p>
            <p className="text-xl font-light">{formatCLP(totals.pending)}</p>
          </div>
          <div className="bg-white p-5">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Reservado</p>
            <p className="text-xl font-light">{formatCLP(totals.reserved)}</p>
          </div>
        </div>

        <div className="mb-6">
          <AdminWalletAdjustForm />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">Movimientos recientes</h2>
        <div className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                <th className="text-left px-4 py-3">Usuaria</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Prenda / motivo</th>
                <th className="text-right px-4 py-3">Pendiente</th>
                <th className="text-right px-4 py-3">Disponible</th>
                <th className="text-left px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(movements ?? []).map(tx => (
                <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="truncate">{tx.user?.name ?? '—'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{tx.user?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{TYPE_LABELS[tx.type]}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 truncate max-w-[220px]">{tx.listing?.title ?? tx.description}</td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    {tx.pending_delta !== 0 ? `${tx.pending_delta > 0 ? '+' : ''}${formatCLP(tx.pending_delta)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    {tx.available_delta !== 0 ? `${tx.available_delta > 0 ? '+' : ''}${formatCLP(tx.available_delta)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
              {(!movements || movements.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">Todavía no hay movimientos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
