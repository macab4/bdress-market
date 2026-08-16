import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureReferralCode, buildReferralLink } from '@/lib/referrals'
import { REFERRAL_REWARD_AMOUNT, REFERRAL_STATUS_CONFIG } from '@/lib/catalog'
import { Referral } from '@/types'
import ReferralInviteCard from '@/components/referrals/ReferralInviteCard'

type ReferralWithReferred = Referral & { referred: { name: string; created_at: string } | null }

export default async function ReferralsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const code = await ensureReferralCode(admin, user.id)
  const link = buildReferralLink(code)

  const { data: referrals } = await admin
    .from('referrals')
    .select('*, referred:profiles!referrals_referred_user_id_fkey(name, created_at)')
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: ReferralWithReferred[] | null }

  const list = referrals ?? []
  const rewardedCount = list.filter(r => r.status === 'rewarded').length

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-xl font-light tracking-widest uppercase">Invita a una amiga 💚</h1>

        <ReferralInviteCard link={link} rewardAmount={REFERRAL_REWARD_AMOUNT} />

        <section className="bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-widest uppercase text-gray-400">
              Tus invitaciones ({list.length})
            </p>
            {rewardedCount > 0 && (
              <p className="text-[10px] text-[#5a7a55]">
                {rewardedCount} acreditada{rewardedCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {list.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Todavía no has invitado a nadie.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {list.map(referral => {
                const status = REFERRAL_STATUS_CONFIG[referral.status] ?? { label: referral.status, color: 'bg-gray-100 text-gray-500' }
                return (
                  <div key={referral.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{referral.referred?.name || 'Usuaria invitada'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Registrada: {new Date(referral.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
