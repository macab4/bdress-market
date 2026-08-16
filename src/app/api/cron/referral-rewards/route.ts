import { createAdminClient } from '@/lib/supabase/admin'
import { recordReferralBonus, sendWalletAlertEmail } from '@/lib/wallet'
import { sendReferralBonusEmail } from '@/lib/email'
import { countRewardedThisMonth, hasReachedMonthlyLimit } from '@/lib/referrals'
import { REFERRAL_REWARD_AMOUNT } from '@/lib/catalog'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). La calificación
// en sí (¿la referida ya publicó su primera prenda?) la detecta un trigger
// en la base de datos apenas se crea el listing (check_first_listing_referral,
// ver migración 20260819000000) — pero ese trigger SOLO marca
// referrals.status='qualified', nunca acredita el bono ni revisa el límite
// mensual. Esa parte queda acá, en TypeScript, a propósito: el resto de las
// reglas de negocio del proyecto (checkout, retiros, disputas) viven en
// TypeScript, no en PL/pgSQL — el ledger en SQL es solo el mecanismo de
// integridad. También significa que un referido que califica con el mes ya
// al tope no se acredita hoy, pero sigue en 'qualified' y este mismo cron
// lo vuelve a evaluar mañana — apenas haya cupo (mes nuevo, u otro referido
// de esa usuaria no llegó a calificar) se acredita solo, sin un job de
// "rollover" aparte.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: qualified } = await admin
    .from('referrals')
    .select('id, referrer_user_id, referred_user_id')
    .eq('status', 'qualified')

  let rewarded = 0
  let skippedLimit = 0

  for (const referral of qualified ?? []) {
    const rewardedThisMonth = await countRewardedThisMonth(admin, referral.referrer_user_id)
    if (hasReachedMonthlyLimit(rewardedThisMonth)) {
      skippedLimit++
      continue
    }

    const result = await recordReferralBonus(admin, {
      referralId: referral.id, referrerId: referral.referrer_user_id, amount: REFERRAL_REWARD_AMOUNT,
    })
    if (!result.ok) {
      await sendWalletAlertEmail({ orderId: referral.id, reason: `referral_bonus: ${result.error}` })
      continue
    }
    // skipped=true acá significaría que ya se había acreditado antes (el
    // idempotency_key de recordReferralBonus lo impide) pero el UPDATE de
    // abajo no llegó a marcar 'rewarded' — corrige el estado sin duplicar
    // el movimiento de saldo.
    const { error: updateErr } = await admin
      .from('referrals')
      .update({ status: 'rewarded', rewarded_at: new Date().toISOString(), reward_transaction_id: result.transactionId ?? null })
      .eq('id', referral.id)
      .eq('status', 'qualified')
    if (updateErr) {
      await sendWalletAlertEmail({ orderId: referral.id, reason: `referral no se pudo marcar rewarded: ${updateErr.message}` })
      continue
    }

    rewarded++

    const [{ data: referrer }, { data: referred }] = await Promise.all([
      admin.from('profiles').select('email, name').eq('id', referral.referrer_user_id).single(),
      admin.from('profiles').select('name').eq('id', referral.referred_user_id).single(),
    ])
    if (referrer?.email) {
      await sendReferralBonusEmail({ to: referrer.email, name: referrer.name, referredName: referred?.name ?? null })
    }

    // Además del correo, una notificación real en la campanita — el correo
    // se puede perder de vista, la campanita con contador no. actor_id es
    // la referida (fue su acción la que disparó el bono), no la propia
    // admin ni un sistema — mismo patrón que usan offer_received/etc.
    await admin.from('notifications').insert({
      user_id: referral.referrer_user_id,
      type: 'referral_bonus',
      actor_id: referral.referred_user_id,
    })
  }

  return Response.json({ rewarded, skippedLimit, evaluated: (qualified ?? []).length })
}
