import { describe, it, expect, vi } from 'vitest'
import { sellerPayout, buyerProtectionFee, paymentProcessingFee } from './catalog'
import {
  orderNetAmount,
  recordSalePending,
  recordSaleRelease,
  recordSaleReversal,
  recordAdminAdjustment,
  recordWithdrawalHold,
  recordWithdrawalCompleted,
  recordWithdrawalCancelled,
  recordPurchaseHold,
  recordPurchaseCompleted,
  recordPurchaseCancelled,
  recordPurchaseRefund,
  computeWalletApplication,
  prorateMercadoPagoItems,
} from './wallet'

// Cliente admin fake mínimo — solo implementa lo que wallet.ts realmente usa
// (rpc, y from().select().eq().eq().maybeSingle() para buscar el
// sale_pending original). No es un mock de supabase-js completo a propósito:
// esto es lo más simple que ejercita el contrato real del código.
function makeAdmin(opts: {
  rpc?: ReturnType<typeof vi.fn>
  salePending?: { id: string; user_id: string; listing_id: string | null; pending_delta: number } | null
} = {}) {
  const rpc = opts.rpc ?? vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_1', account_id: 'acc_1', inserted: true }], error: null })
  const maybeSingle = vi.fn().mockResolvedValue({ data: opts.salePending ?? null })
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  }))
  return { rpc, from } as unknown as Parameters<typeof recordSalePending>[0]
}

describe('orderNetAmount', () => {
  it('coincide con sellerPayout(price) de catalog.ts para un rango de precios', () => {
    // amount = price + commission (buyerProtectionFee), processing_fee =
    // paymentProcessingFee(price) — ver payment/create/route.ts. Se importan
    // las constantes reales de catalog.ts (nunca hardcodeadas acá) para que
    // este test no pueda quedar desincronizado si el % de procesamiento
    // cambia — si esta fórmula alguna vez diverge de sellerPayout(), este
    // test lo detecta igual.
    for (const price of [5000, 9990, 15000, 32500, 99999, 250000]) {
      const commission = buyerProtectionFee(price)
      const processingFee = paymentProcessingFee(price)
      const amount = price + commission
      expect(orderNetAmount({ amount, commission, processing_fee: processingFee })).toBe(sellerPayout(price))
    }
  })
})

describe('recordSalePending', () => {
  it('llama a record_wallet_transaction con el delta pendiente y el order_id', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordSalePending(admin, {
      id: 'order_1', seller_id: 'seller_1', listing_id: 'listing_1',
      amount: 11000, commission: 1000, processing_fee: 875,
    })

    expect(result).toEqual({ ok: true, skipped: false, transactionId: 'tx_1' })
    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_user_id: 'seller_1',
      p_type: 'sale_pending',
      p_pending_delta: 9125, // 11000 - 1000 - 875
      p_available_delta: 0,
      p_order_id: 'order_1',
      p_listing_id: 'listing_1',
    }))
  })

  it('idempotencia: si el RPC devuelve inserted=false, no falla y marca skipped', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: null, account_id: 'acc_1', inserted: false }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordSalePending(admin, {
      id: 'order_1', seller_id: 'seller_1', listing_id: 'listing_1',
      amount: 11000, commission: 1000, processing_fee: 875,
    })

    expect(result).toEqual({ ok: true, skipped: true, transactionId: undefined })
  })
})

describe('recordSaleRelease', () => {
  it('venta no completada (sin sale_pending) no libera saldo', async () => {
    const admin = makeAdmin({ salePending: null })
    const result = await recordSaleRelease(admin, 'order_1', { source: 'cron_confirmed_hold' })

    expect(result).toEqual({ ok: true, skipped: true, reason: 'no_sale_pending_found' })
    expect((admin as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled()
  })

  it('reusa el pending_delta original (nunca recalcula) al liberar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_2', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({
      rpc,
      salePending: { id: 'tx_original', user_id: 'seller_1', listing_id: 'listing_1', pending_delta: 58910 },
    })

    const result = await recordSaleRelease(admin, 'order_1', { source: 'cron_shipped_fallback' })

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_user_id: 'seller_1',
      p_type: 'sale_release',
      p_pending_delta: -58910,
      p_available_delta: 58910,
      p_order_id: 'order_1',
      p_related_transaction_id: 'tx_original',
    }))
  })
})

describe('recordSaleReversal', () => {
  it('revierte exactamente el pending_delta original con signo negativo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_3', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({
      rpc,
      salePending: { id: 'tx_original', user_id: 'seller_1', listing_id: 'listing_1', pending_delta: 58910 },
    })

    const result = await recordSaleReversal(admin, 'order_1', {})

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_user_id: 'seller_1',
      p_type: 'sale_reversal',
      p_pending_delta: -58910,
      p_available_delta: 0,
      p_related_transaction_id: 'tx_original',
    }))
  })

  it('orden sin sale_pending (venta ya liberada o anterior al wallet) no revierte nada', async () => {
    const admin = makeAdmin({ salePending: null })
    const result = await recordSaleReversal(admin, 'order_1', {})
    expect(result).toEqual({ ok: true, skipped: true, reason: 'no_sale_pending_found' })
  })
})

describe('recordWithdrawalHold', () => {
  it('mueve el monto de disponible a reservado con idempotency_key por retiro', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_h1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordWithdrawalHold(admin, { withdrawalId: 'w_1', userId: 'seller_1', amount: 60000 })

    expect(result).toEqual({ ok: true, skipped: false, transactionId: 'tx_h1' })
    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'withdrawal_hold', p_available_delta: -60000, p_reserved_delta: 60000,
      p_idempotency_key: 'withdrawal_hold:w_1',
    }))
  })

  it('retiro no puede superar saldo disponible: el RPC falla y la función propaga el error sin lanzar', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'new row for relation "wallet_accounts" violates check constraint "wallet_accounts_available_nonneg"' },
    })
    const admin = makeAdmin({ rpc })

    const result = await recordWithdrawalHold(admin, { withdrawalId: 'w_2', userId: 'seller_1', amount: 999999 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/available_nonneg/)
  })
})

describe('recordWithdrawalCompleted', () => {
  it('mueve reservado a cero sin tocar disponible (la plata sale del sistema)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_c1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordWithdrawalCompleted(admin, { withdrawalId: 'w_1', userId: 'seller_1', amount: 60000, createdBy: 'admin_1' })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'withdrawal_completed', p_available_delta: 0, p_reserved_delta: -60000,
      p_idempotency_key: 'withdrawal_completed:w_1',
    }))
  })

  it('admin no puede completar dos veces: segundo llamado devuelve inserted=false → skipped', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: null, account_id: 'acc_1', inserted: false }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordWithdrawalCompleted(admin, { withdrawalId: 'w_1', userId: 'seller_1', amount: 60000, createdBy: 'admin_1' })

    expect(result).toEqual({ ok: true, skipped: true, transactionId: undefined })
  })
})

describe('recordWithdrawalCancelled', () => {
  it('devuelve el monto reservado a disponible', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_r1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordWithdrawalCancelled(admin, { withdrawalId: 'w_1', userId: 'seller_1', amount: 60000, reason: 'Datos bancarios incorrectos', createdBy: 'admin_1' })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'withdrawal_cancelled', p_available_delta: 60000, p_reserved_delta: -60000,
      p_idempotency_key: 'withdrawal_cancelled:w_1',
    }))
  })
})

describe('recordPurchaseHold', () => {
  it('mueve el monto de disponible a reservado con idempotency_key por orden', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_ph1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordPurchaseHold(admin, { orderId: 'order_1', userId: 'buyer_1', amount: 20000 })

    expect(result).toEqual({ ok: true, skipped: false, transactionId: 'tx_ph1' })
    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_user_id: 'buyer_1',
      p_type: 'marketplace_purchase_hold',
      p_available_delta: -20000,
      p_reserved_delta: 20000,
      p_order_id: 'order_1',
    }))
  })

  it('saldo insuficiente: el RPC falla y la función propaga el error sin lanzar', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'new row for relation "wallet_accounts" violates check constraint "wallet_accounts_available_nonneg"' },
    })
    const admin = makeAdmin({ rpc })

    const result = await recordPurchaseHold(admin, { orderId: 'order_1', userId: 'buyer_1', amount: 999999 })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/available_nonneg/)
  })
})

describe('recordPurchaseCompleted', () => {
  it('mueve reservado a cero sin tocar disponible, referenciando el hold original', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_pc1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordPurchaseCompleted(admin, {
      orderId: 'order_1', userId: 'buyer_1', amount: 20000, holdTransactionId: 'tx_ph1',
    })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'marketplace_purchase', p_available_delta: 0, p_reserved_delta: -20000,
      p_order_id: 'order_1', p_related_transaction_id: 'tx_ph1',
    }))
  })
})

describe('recordPurchaseCancelled', () => {
  it('devuelve el monto reservado a disponible (orden abandonada/expirada)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_pcx1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordPurchaseCancelled(admin, {
      orderId: 'order_1', userId: 'buyer_1', amount: 20000,
      reason: 'order_abandoned_or_reassigned', holdTransactionId: 'tx_ph1',
    })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'marketplace_purchase_cancelled', p_available_delta: 20000, p_reserved_delta: -20000,
      p_order_id: 'order_1', p_related_transaction_id: 'tx_ph1',
    }))
  })

  it('idempotencia: si ya se había liberado, el RPC devuelve inserted=false → skipped', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: null, account_id: 'acc_1', inserted: false }], error: null })
    const admin = makeAdmin({ rpc })

    const result = await recordPurchaseCancelled(admin, {
      orderId: 'order_1', userId: 'buyer_1', amount: 20000, reason: 'order_abandoned_or_reassigned',
    })

    expect(result).toEqual({ ok: true, skipped: true, transactionId: undefined })
  })
})

describe('recordPurchaseRefund', () => {
  it('devuelve el monto a disponible sin tocar reservado (la orden ya estaba paid)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_pr1', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordPurchaseRefund(admin, {
      orderId: 'order_1', userId: 'buyer_1', amount: 20000,
      reason: 'admin_refund', holdTransactionId: 'tx_ph1', createdBy: 'admin_1',
    })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_type: 'marketplace_purchase_refund', p_available_delta: 20000, p_reserved_delta: 0,
      p_order_id: 'order_1', p_related_transaction_id: 'tx_ph1',
    }))
  })
})

describe('computeWalletApplication', () => {
  it('capea al disponible cuando la compradora pide más de lo que tiene', () => {
    expect(computeWalletApplication({ totalAmount: 50000, availableBalance: 10000, requestedAmount: 50000 })).toBe(10000)
  })

  it('capea al total cuando el saldo disponible supera el total de la orden', () => {
    expect(computeWalletApplication({ totalAmount: 30000, availableBalance: 100000, requestedAmount: 100000 })).toBe(30000)
  })

  it('nunca es negativo aunque los inputs lo sean', () => {
    expect(computeWalletApplication({ totalAmount: 30000, availableBalance: -500, requestedAmount: 10000 })).toBe(0)
    expect(computeWalletApplication({ totalAmount: 30000, availableBalance: 10000, requestedAmount: -1000 })).toBe(0)
  })

  it('respeta un monto parcial válido dentro de ambos límites', () => {
    expect(computeWalletApplication({ totalAmount: 30000, availableBalance: 10000, requestedAmount: 4000 })).toBe(4000)
  })
})

describe('prorateMercadoPagoItems', () => {
  it('sin saldo aplicado, devuelve los 3 ítems completos', () => {
    const items = prorateMercadoPagoItems({ price: 20000, commission: 2000, shippingCost: 3000, walletAmountApplied: 0 })
    expect(items).toEqual([
      { title: 'Prenda', unitPrice: 20000 },
      { title: 'Protección BDress', unitPrice: 2000 },
      { title: 'Envío', unitPrice: 3000 },
    ])
  })

  it('resta secuencialmente Prenda → Protección → Envío y filtra los ítems en $0', () => {
    // saldo cubre toda la prenda (20000) + parte de la protección (1500 de 2000)
    const items = prorateMercadoPagoItems({ price: 20000, commission: 2000, shippingCost: 3000, walletAmountApplied: 21500 })
    expect(items).toEqual([
      { title: 'Protección BDress', unitPrice: 500 },
      { title: 'Envío', unitPrice: 3000 },
    ])
  })

  it('saldo cubre el total exacto: no quedan ítems (camino 100% saldo)', () => {
    const items = prorateMercadoPagoItems({ price: 20000, commission: 2000, shippingCost: 3000, walletAmountApplied: 25000 })
    expect(items).toEqual([])
  })

  it('la suma de los ítems resultantes siempre cuadra con lo que falta pagar', () => {
    const price = 20000, commission = 2000, shippingCost = 3000, walletAmountApplied = 8750
    const items = prorateMercadoPagoItems({ price, commission, shippingCost, walletAmountApplied })
    const sum = items.reduce((acc, item) => acc + item.unitPrice, 0)
    expect(sum).toBe(price + commission + shippingCost - walletAmountApplied)
  })
})

describe('recordAdminAdjustment', () => {
  it('admin_credit envía un delta positivo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_4', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordAdminAdjustment(admin, {
      userId: 'user_1', type: 'admin_credit', amount: 5000, reason: 'Compensación por envío perdido',
      idempotencyKey: 'key-1', createdBy: 'admin_1',
    })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_available_delta: 5000,
      p_idempotency_key: 'key-1',
    }))
  })

  it('admin_debit envía un delta negativo aunque el monto venga positivo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ transaction_id: 'tx_5', account_id: 'acc_1', inserted: true }], error: null })
    const admin = makeAdmin({ rpc })

    await recordAdminAdjustment(admin, {
      userId: 'user_1', type: 'admin_debit', amount: 3000, reason: 'Corrección de doble acreditación',
      idempotencyKey: 'key-2', createdBy: 'admin_1',
    })

    expect(rpc).toHaveBeenCalledWith('record_wallet_transaction', expect.objectContaining({
      p_available_delta: -3000,
    }))
  })
})
