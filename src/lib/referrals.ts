import { createAdminClient } from '@/lib/supabase/admin'
import { REFERRAL_MONTHLY_LIMIT } from '@/lib/catalog'

type AdminClient = ReturnType<typeof createAdminClient>

// Charset sin caracteres ambiguos (sin 0/O, 1/I/L) — el código se comparte
// en voz alta o por WhatsApp, así que tiene que leerse sin dudas.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8

export function generateReferralCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function buildReferralLink(code: string): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${code}`
}

// Genera y guarda el referral_code de una usuaria si todavía no tiene uno
// — perezoso (recién al entrar a "Invita a una amiga"), no en el signup,
// para no tocar handle_new_user más de lo necesario. Reintenta unas pocas
// veces ante una colisión (constraint unique en profiles.referral_code) —
// con este alfabeto (32^8 combinaciones) la probabilidad real de chocar es
// insignificante, el retry es solo una red de seguridad barata.
export async function ensureReferralCode(admin: AdminClient, userId: string): Promise<string> {
  const { data: profile } = await admin.from('profiles').select('referral_code').eq('id', userId).single()
  if (profile?.referral_code) return profile.referral_code

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode()
    const { error } = await admin.from('profiles').update({ referral_code: code }).eq('id', userId)
    if (!error) return code
  }
  throw new Error('No se pudo generar un código de invitación único')
}

// Cuántos referidos ya se le acreditaron a esta referrer en el mes
// calendario actual — usado por cron/referral-rewards para respetar
// REFERRAL_MONTHLY_LIMIT. Un referido que califica estando el mes ya al
// tope simplemente queda 'qualified' sin acreditar — el cron lo vuelve a
// evaluar al día siguiente, así que apenas empiece el mes que viene (o se
// libere cupo) se acredita solo, sin necesidad de un job de "rollover" aparte.
export async function countRewardedThisMonth(admin: AdminClient, referrerId: string): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count } = await admin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referrerId)
    .eq('status', 'rewarded')
    .gte('rewarded_at', monthStart)
  return count ?? 0
}

export function hasReachedMonthlyLimit(rewardedThisMonth: number): boolean {
  return rewardedThisMonth >= REFERRAL_MONTHLY_LIMIT
}
