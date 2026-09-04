import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminUser } from '@/lib/admin-auth'
import { Withdrawal, WithdrawalStatus } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import { accountTypeLabel } from '@/lib/bankAccounts'
import AdminWithdrawalActions from '@/components/admin/AdminWithdrawalActions'

const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  completed: 'Transferido',
  rejected: 'Rechazado',
}

function formatCLP(n: number) {
  return `$${n.toLocaleString('es-CL')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function AdminWithdrawalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const admin = createAdminClient()

  const { data: withdrawal } = await admin
    .from('withdrawals')
    .select('*, user:profiles!withdrawals_user_id_fkey(name, email), admin:profiles!withdrawals_admin_id_fkey(name)')
    .eq('id', id)
    .single() as unknown as { data: (Withdrawal & { admin: { name: string } | null }) | null }

  if (!withdrawal) notFound()

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/wallet" />
        </div>

        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          <Link href="/admin/wallet/withdrawals" className="hover:text-black">Retiros</Link> · {withdrawal.id}
        </p>

        <div className="bg-white p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-gray-400">{withdrawal.user?.name} · {withdrawal.user?.email}</p>
              <p className="text-2xl font-light mt-1">{formatCLP(withdrawal.amount)}</p>
            </div>
            <span className="text-[9px] tracking-widest uppercase px-2 py-1 bg-gray-100 text-gray-600 whitespace-nowrap">
              {STATUS_LABELS[withdrawal.status]}
            </span>
          </div>

          {/* Único lugar donde se muestra el número de cuenta completo —
              la admin lo necesita para hacer la transferencia manual. */}
          <div className="bg-gray-50 p-3 text-xs text-gray-600 space-y-0.5 mb-4">
            <p><span className="text-gray-400">Banco:</span> {withdrawal.bank}</p>
            <p><span className="text-gray-400">Tipo:</span> {accountTypeLabel(withdrawal.account_type)}</p>
            <p><span className="text-gray-400">N.º de cuenta:</span> <span className="font-mono">{withdrawal.account_number}</span></p>
            <p><span className="text-gray-400">RUT titular:</span> {withdrawal.holder_rut}</p>
            <p><span className="text-gray-400">Nombre titular:</span> {withdrawal.holder_name}</p>
            {withdrawal.holder_email && <p><span className="text-gray-400">Email:</span> {withdrawal.holder_email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <p>Solicitado: {formatDate(withdrawal.requested_at)}</p>
            <p>Procesado: {formatDate(withdrawal.processed_at)}</p>
            {withdrawal.admin && <p>Admin: {withdrawal.admin.name}</p>}
            {withdrawal.operation_number && <p>N.º operación: {withdrawal.operation_number}</p>}
          </div>
          {withdrawal.internal_note && (
            <p className="text-xs text-gray-500 mt-3 border-t border-gray-100 pt-3">Nota: {withdrawal.internal_note}</p>
          )}
        </div>

        {(withdrawal.status === 'pending' || withdrawal.status === 'processing') && (
          <AdminWithdrawalActions withdrawalId={withdrawal.id} status={withdrawal.status} />
        )}
      </div>
    </div>
  )
}
