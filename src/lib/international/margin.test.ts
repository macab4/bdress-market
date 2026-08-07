import { describe, it, expect } from 'vitest'
import { calculateMargin, estimatedMargin, realMargin } from './margin'
import { paymentProcessingFee } from '@/lib/catalog'

describe('calculateMargin', () => {
  it('resta todos los costos del precio de venta', () => {
    const result = calculateMargin({
      salePrice: 100000,
      purchaseCost: 30000,
      internationalLogisticsCost: 10000,
      customsCost: 5000,
      nationalShippingSubsidy: 2000,
    })
    const paymentCost = paymentProcessingFee(100000)
    expect(result.margin).toBe(100000 - 30000 - 10000 - 5000 - paymentCost - 2000)
  })

  it('trata costos null como 0', () => {
    const result = calculateMargin({ salePrice: 50000, purchaseCost: null, internationalLogisticsCost: null, customsCost: null })
    expect(result.purchaseCost).toBe(0)
    expect(result.internationalLogisticsCost).toBe(0)
    expect(result.customsCost).toBe(0)
    expect(result.margin).toBe(50000 - paymentProcessingFee(50000))
  })
})

describe('estimatedMargin vs realMargin', () => {
  it('estimatedMargin usa los estimados, no el costo real de compra', () => {
    const result = estimatedMargin(100000, 20000, 5000)
    expect(result.purchaseCost).toBe(0)
    expect(result.internationalLogisticsCost).toBe(20000)
    expect(result.customsCost).toBe(5000)
  })

  it('realMargin usa el costo real de compra, no el estimado internacional', () => {
    const result = realMargin(100000, 35000, 5000)
    expect(result.purchaseCost).toBe(35000)
    expect(result.internationalLogisticsCost).toBe(0)
    expect(result.customsCost).toBe(5000)
  })
})
