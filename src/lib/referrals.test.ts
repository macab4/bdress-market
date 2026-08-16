import { describe, it, expect } from 'vitest'
import { generateReferralCode, buildReferralLink, hasReachedMonthlyLimit } from './referrals'
import { REFERRAL_MONTHLY_LIMIT } from './catalog'

describe('generateReferralCode', () => {
  it('genera un código de 8 caracteres, sin 0/O/1/I/L (se comparte de palabra o por WhatsApp)', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode()
      expect(code).toHaveLength(8)
      expect(code).not.toMatch(/[01OIL]/)
      expect(code).toMatch(/^[A-Z0-9]+$/)
    }
  })

  it('no genera siempre el mismo código (aleatoriedad mínima)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateReferralCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('buildReferralLink', () => {
  it('arma el link público con el código', () => {
    const link = buildReferralLink('MACA123A')
    expect(link).toContain('/invite/MACA123A')
  })
})

// El límite mensual (sección 7 del encargo) — la fuente de verdad real es
// el conteo de referrals.status='rewarded' del mes calendario actual (ver
// countRewardedThisMonth, que necesita un cliente de base de datos real y
// por eso no se prueba acá con mocks) — esta es la regla de decisión pura
// que aplica cron/referral-rewards sobre ese conteo.
describe('hasReachedMonthlyLimit', () => {
  it(`no ha llegado al tope con menos de ${REFERRAL_MONTHLY_LIMIT} acreditados este mes`, () => {
    expect(hasReachedMonthlyLimit(0)).toBe(false)
    expect(hasReachedMonthlyLimit(REFERRAL_MONTHLY_LIMIT - 1)).toBe(false)
  })

  it(`llegó al tope justo en ${REFERRAL_MONTHLY_LIMIT} — el sexto referido de ese mes no se acredita`, () => {
    expect(hasReachedMonthlyLimit(REFERRAL_MONTHLY_LIMIT)).toBe(true)
    expect(hasReachedMonthlyLimit(REFERRAL_MONTHLY_LIMIT + 1)).toBe(true)
  })
})
