import { describe, it, expect } from 'vitest'
import { nextInternationalStatus, InvalidInternationalTransitionError, isPastEstimatedDelivery } from './status'

describe('nextInternationalStatus', () => {
  it('permite la transición feliz completa, un paso a la vez', () => {
    expect(nextInternationalStatus('confirm_availability', 'awaiting_source_verification')).toBe('source_confirmed')
    expect(nextInternationalStatus('register_external_purchase', 'source_confirmed')).toBe('source_purchased')
    expect(nextInternationalStatus('mark_received_spain', 'source_purchased')).toBe('received_at_foreign_hub')
    expect(nextInternationalStatus('mark_in_transit', 'received_at_foreign_hub')).toBe('international_transit')
    expect(nextInternationalStatus('mark_received_chile', 'international_transit')).toBe('received_in_chile')
    expect(nextInternationalStatus('approve_quality_check', 'received_in_chile')).toBe('quality_check')
    expect(nextInternationalStatus('prepare_national_shipping', 'quality_check')).toBe('national_shipping_pending')
    expect(nextInternationalStatus('mark_nationally_shipped', 'national_shipping_pending')).toBe('nationally_shipped')
    expect(nextInternationalStatus('mark_delivered', 'nationally_shipped')).toBe('delivered')
  })

  it('permite la rama de cancelación y reembolso', () => {
    expect(nextInternationalStatus('mark_unavailable', 'awaiting_source_verification')).toBe('source_unavailable')
    expect(nextInternationalStatus('start_cancellation', 'source_unavailable')).toBe('cancellation_pending')
    expect(nextInternationalStatus('begin_refund', 'cancellation_pending')).toBe('refund_pending')
    expect(nextInternationalStatus('confirm_refund', 'refund_pending')).toBe('refunded')
  })

  it('rechaza una acción que no aplica al estado actual', () => {
    expect(() => nextInternationalStatus('mark_delivered', 'awaiting_source_verification'))
      .toThrow(InvalidInternationalTransitionError)
  })

  it('rechaza saltarse un paso del carril feliz', () => {
    expect(() => nextInternationalStatus('mark_received_chile', 'source_confirmed'))
      .toThrow(InvalidInternationalTransitionError)
  })

  it('rechaza aplicar una acción sin estado actual', () => {
    expect(() => nextInternationalStatus('confirm_availability', null))
      .toThrow(InvalidInternationalTransitionError)
  })

  it('no permite confirmar disponibilidad dos veces seguidas', () => {
    expect(() => nextInternationalStatus('confirm_availability', 'source_confirmed'))
      .toThrow(InvalidInternationalTransitionError)
  })
})

describe('isPastEstimatedDelivery', () => {
  it('es false si todavía no se paga', () => {
    expect(isPastEstimatedDelivery(null, 30, 'awaiting_source_verification')).toBe(false)
  })

  it('es false si ya está entregado o reembolsado, sin importar la fecha', () => {
    const longAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    expect(isPastEstimatedDelivery(longAgo, 30, 'delivered')).toBe(false)
    expect(isPastEstimatedDelivery(longAgo, 30, 'refunded')).toBe(false)
  })

  it('es true si pasó el plazo máximo sin entregarse', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    expect(isPastEstimatedDelivery(fortyDaysAgo, 30, 'international_transit')).toBe(true)
  })

  it('es false si todavía está dentro del plazo', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    expect(isPastEstimatedDelivery(fiveDaysAgo, 30, 'international_transit')).toBe(false)
  })
})
