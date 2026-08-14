// Catálogo de transportistas conocidos — extensible por diseño: agregar uno
// nuevo es agregar una entrada a CARRIERS. La detección automática de
// transportista/N.º de seguimiento vive en extractLabelInfo.ts (lee la
// etiqueta con Claude); esto solo mapea un CarrierId a su nombre visible e
// instrucciones para la vendedora.

export type CarrierId = 'chilexpress' | 'starken' | 'blueexpress'

interface CarrierConfig {
  id: CarrierId
  label: string
  sellerInstructions: string
}

const CARRIERS: CarrierConfig[] = [
  {
    id: 'chilexpress',
    label: 'Chilexpress',
    sellerInstructions: 'Debes llevar tu paquete a Chilexpress utilizando la etiqueta adjunta.',
  },
  {
    id: 'starken',
    label: 'Starken',
    sellerInstructions: 'Debes llevar tu paquete a una sucursal Starken utilizando la etiqueta adjunta.',
  },
  {
    id: 'blueexpress',
    label: 'Blue Express',
    sellerInstructions: 'Debes coordinar el retiro/despacho con Blue Express utilizando la etiqueta adjunta.',
  },
]

export function carrierLabel(id: string): string {
  return CARRIERS.find(c => c.id === id)?.label ?? id
}

export function carrierInstructions(id: string): string {
  return CARRIERS.find(c => c.id === id)?.sellerInstructions ?? 'Sigue las instrucciones de la etiqueta adjunta.'
}
