import { paymentProcessingFee } from '@/lib/catalog'

// Cálculo de margen de un producto internacional (sección 10 del encargo).
// Asunción explícita: todos los montos de costo (compra externa, estimado
// internacional/aduana) se ingresan en el panel admin ya convertidos a CLP —
// esta versión no incorpora conversión de moneda automática, así que la
// persona administradora convierte a mano al registrar cada costo.
export interface MarginInput {
  salePrice: number // precio final que paga la clienta por la prenda (sin comisión de protección)
  purchaseCost: number | null // costo real (o estimado) de compra en origen, en CLP
  internationalLogisticsCost: number | null // envío UE + envío internacional + manejo, en CLP
  customsCost: number | null // estimado o real de aduana, en CLP
  nationalShippingSubsidy?: number // parte del despacho nacional que Bdress absorbe, si corresponde (0 si no se subsidia)
}

export interface MarginResult {
  salePrice: number
  purchaseCost: number
  internationalLogisticsCost: number
  customsCost: number
  paymentProcessingCost: number
  nationalShippingSubsidy: number
  margin: number
}

export function calculateMargin(input: MarginInput): MarginResult {
  const purchaseCost = input.purchaseCost ?? 0
  const internationalLogisticsCost = input.internationalLogisticsCost ?? 0
  const customsCost = input.customsCost ?? 0
  const nationalShippingSubsidy = input.nationalShippingSubsidy ?? 0
  const paymentProcessingCost = paymentProcessingFee(input.salePrice)

  const margin = input.salePrice
    - purchaseCost
    - internationalLogisticsCost
    - customsCost
    - paymentProcessingCost
    - nationalShippingSubsidy

  return {
    salePrice: input.salePrice,
    purchaseCost,
    internationalLogisticsCost,
    customsCost,
    paymentProcessingCost,
    nationalShippingSubsidy,
    margin,
  }
}

// Margen estimado (antes de comprar en origen): usa los estimados cargados
// al publicar. Margen real: una vez registrada la compra externa, se
// recalcula con external_purchase_price en vez de international_cost_estimate.
export function estimatedMargin(salePrice: number, costEstimate: number | null, customsEstimate: number | null): MarginResult {
  return calculateMargin({ salePrice, purchaseCost: null, internationalLogisticsCost: costEstimate, customsCost: customsEstimate })
}

export function realMargin(salePrice: number, externalPurchasePrice: number | null, customsEstimate: number | null): MarginResult {
  return calculateMargin({ salePrice, purchaseCost: externalPurchasePrice, internationalLogisticsCost: null, customsCost: customsEstimate })
}
