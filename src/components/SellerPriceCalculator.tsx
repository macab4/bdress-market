'use client'

import { useState } from 'react'
import { sellerPayout, buyerProtectionFee, PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED, COMMISSION_PCT } from '@/lib/catalog'

export default function SellerPriceCalculator() {
  const [price, setPrice] = useState('')
  const numericPrice = parseInt(price) || 0
  const processingFee = numericPrice - sellerPayout(numericPrice)

  return (
    <div className="bg-gray-50 p-4">
      <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
        ¿Cuánto quieres cobrar por tu prenda?
      </label>
      <div className="relative mb-3">
        <span className="absolute left-3 top-2.5 text-sm text-gray-400">$</span>
        <input
          type="number"
          min="0"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="25000"
          className="w-full border border-gray-200 pl-7 pr-3 py-2 text-sm bg-white focus:outline-none focus:border-gray-400"
        />
      </div>

      {numericPrice > 0 && (
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Precio de venta</span>
            <span>${numericPrice.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Procesamiento ({Math.round(PROCESSING_FEE_PCT * 100)}% + ${PROCESSING_FEE_FIXED})</span>
            <span>− ${processingFee.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between font-medium text-gray-800 border-t border-gray-200 pt-1 mt-1">
            <span>Vas a recibir</span>
            <span>${sellerPayout(numericPrice).toLocaleString('es-CL')}</span>
          </div>
          <p className="text-[10px] text-gray-400 pt-2">
            La compradora va a pagar ${(numericPrice + buyerProtectionFee(numericPrice)).toLocaleString('es-CL')} en
            total (+ envío aparte), que incluye el {Math.round(COMMISSION_PCT * 100)}% de Protección BDress.
          </p>
        </div>
      )}
    </div>
  )
}
