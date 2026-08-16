import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureReferralCode, buildReferralLink, countRewardedThisMonth } from '@/lib/referrals'
import { REFERRAL_REWARD_AMOUNT, REFERRAL_MONTHLY_LIMIT } from '@/lib/catalog'
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

  const [{ data: referrals }, rewardedThisMonth] = await Promise.all([
    admin
      .from('referrals')
      .select('*, referred:profiles!referrals_referred_user_id_fkey(name, created_at)')
      .eq('referrer_user_id', user.id)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: ReferralWithReferred[] | null }>,
    countRewardedThisMonth(admin, user.id),
  ])

  const list = (referrals ?? []).map(r => ({ id: r.id, name: r.referred?.name ?? null, status: r.status }))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-xl font-light tracking-widest uppercase">
          Invita y gana ${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')} 💚
        </h1>

        <ReferralInviteCard
          link={link}
          rewardAmount={REFERRAL_REWARD_AMOUNT}
          monthlyLimit={REFERRAL_MONTHLY_LIMIT}
          rewardedThisMonth={rewardedThisMonth}
          referrals={list}
        />
      </div>
    </div>
  )
}
