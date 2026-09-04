import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { REFERRAL_REWARD_AMOUNT, REFERRAL_STATUS_CONFIG } from '@/lib/catalog'
import { Referral, ReferralStatus } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import WalletSubNav from '@/components/admin/WalletSubNav'

type ReferralRow = Referral & {
  referrer: { name: string; email: string } | null
  referred: { name: string; email: string; created_at: string } | null
}

const FILTERS: { value: ReferralStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'registered', label: 'Pendientes' },
  { value: 'qualified', label: 'Calificados' },
  { value: 'rewarded', label: 'Acreditados' },
  { value: 'rejected', label: 'Rechazados' },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdminUser()
  const { status } = await searchParams
  const activeFilter = FILTERS.some(f => f.value === status) ? (status as ReferralStatus | 'all') : 'all'

  const admin = createAdminClient()
  let query = admin
    .from('referrals')
    .select('*, referrer:profiles!referrals_referrer_user_id_fkey(name, email), referred:profiles!referrals_referred_user_id_fkey(name, email, created_at)')
    .order('created_at', { ascending: false })
  if (activeFilter !== 'all') query = query.eq('status', activeFilter)

  const { data: referrals } = await query as unknown as { data: ReferralRow[] | null }
  const list = referrals ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/wallet" />
        </div>

        <WalletSubNav active="referidos" />

        <div className="flex gap-4 mb-6">
          {FILTERS.map(f => (
            <Link
              key={f.value}
              href={f.value === 'all' ? '/admin/referrals' : `/admin/referrals?status=${f.value}`}
              className={`text-[10px] tracking-widest uppercase pb-1 ${activeFilter === f.value ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                <th className="text-left px-4 py-3">Invitó</th>
                <th className="text-left px-4 py-3">Invitada</th>
                <th className="text-left px-4 py-3">Registrada</th>
                <th className="text-left px-4 py-3">Primera publicación</th>
                <th className="text-right px-4 py-3">Bono</th>
                <th className="text-left px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map(referral => {
                const badge = REFERRAL_STATUS_CONFIG[referral.status] ?? { label: referral.status, color: 'bg-gray-100 text-gray-500' }
                return (
                  <tr key={referral.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="truncate">{referral.referrer?.name ?? '—'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{referral.referrer?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate">{referral.referred?.name ?? '—'}</p>
                      <p className="text-[10px] text-gray-400 truncate">{referral.referred?.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(referral.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(referral.qualified_at)}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {referral.status === 'rewarded' ? `$${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No hay referidos en este estado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
