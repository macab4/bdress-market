import { describe, it, expect } from 'vitest'
import { buyerProtectionFee, paymentProcessingFee, sellerPayout, COMMISSION_PCT, PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED } from './catalog'

// Red de seguridad: estas funciones ya existían y no cambian con la
// modalidad internacional, pero el checkout internacional depende de ellas
// (payment/create/route.ts) — cubrirlas evita una regresión silenciosa.
describe('fees existentes', () => {
  it('buyerProtectionFee redondea el % de comisión', () => {
    expect(buyerProtectionFee(10000)).toBe(Math.round(10000 * COMMISSION_PCT))
  })

  it('paymentProcessingFee combina % y monto fijo', () => {
    expect(paymentProcessingFee(10000)).toBe(Math.round(10000 * PROCESSING_FEE_PCT) + PROCESSING_FEE_FIXED)
  })

  it('sellerPayout descuenta el costo de procesamiento del precio', () => {
    expect(sellerPayout(10000)).toBe(10000 - paymentProcessingFee(10000))
  })
})
