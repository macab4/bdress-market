// Seam para una futura integración oficial con Vinted (u otra plataforma
// internacional) — sección 16 del encargo. En esta versión NO existe ninguna
// integración automática: la compra en Vinted es 100% manual, hecha por una
// persona del equipo B-Dress. Nada en este archivo se conecta a Vinted, hace
// scraping, ni automatiza un login — ManualExternalMarketplaceProvider solo
// documenta el contrato que una integración futura debería cumplir.
//
// Una integración automática real SOLO debe implementarse contra una API
// oficial de la plataforma de origen, con autorización explícita de esa
// plataforma para las operaciones que realice (consultar disponibilidad,
// comprar, hacer seguimiento). Hasta que eso exista, todas las acciones del
// panel admin registran lo que la persona administradora ingresó a mano.

export interface ExternalListingAvailability {
  available: boolean
  priceMinorUnits?: number
  currency?: string
  checkedAt: string
}

export interface ExternalListingDetails {
  url: string
  title?: string
  priceMinorUnits?: number
  currency?: string
  sellerName?: string
  location?: string
}

export interface ExternalPurchaseResult {
  externalOrderReference: string
  purchasedAt: string
  purchasePriceMinorUnits: number
  currency: string
}

export interface ExternalTrackingInfo {
  trackingNumber?: string
  trackingUrl?: string
  status?: string
}

export interface ExternalMarketplaceProvider {
  verifyListingAvailability(input: { sourceUrl: string; sourceListingId?: string | null }): Promise<ExternalListingAvailability>
  retrieveListingDetails(input: { sourceUrl: string; sourceListingId?: string | null }): Promise<ExternalListingDetails>
  createExternalPurchase(input: { sourceUrl: string; sourceListingId?: string | null; maxPriceMinorUnits: number }): Promise<ExternalPurchaseResult>
  retrieveExternalOrder(input: { externalOrderReference: string }): Promise<{ status: string }>
  retrieveExternalTracking(input: { externalOrderReference: string }): Promise<ExternalTrackingInfo>
}

export class ManualExternalMarketplaceProviderError extends Error {
  constructor(method: string) {
    super(
      `${method} no está disponible: la modalidad internacional funciona 100% manual en esta versión. ` +
      'Usa las acciones del panel admin (Comprobar disponibilidad, Registrar compra en Vinted, Registrar tracking, ' +
      'etc.) para dejar constancia de lo que se hizo a mano. Una integración automática real solo debe construirse ' +
      'contra una API oficial y autorizada de la plataforma de origen.'
    )
    this.name = 'ManualExternalMarketplaceProviderError'
  }
}

// No se conecta a Vinted, no hace scraping ni navegación automatizada, no
// guarda credenciales ni cookies de Vinted, no automatiza ningún login.
export class ManualExternalMarketplaceProvider implements ExternalMarketplaceProvider {
  async verifyListingAvailability(): Promise<ExternalListingAvailability> {
    throw new ManualExternalMarketplaceProviderError('verifyListingAvailability')
  }
  async retrieveListingDetails(): Promise<ExternalListingDetails> {
    throw new ManualExternalMarketplaceProviderError('retrieveListingDetails')
  }
  async createExternalPurchase(): Promise<ExternalPurchaseResult> {
    throw new ManualExternalMarketplaceProviderError('createExternalPurchase')
  }
  async retrieveExternalOrder(): Promise<{ status: string }> {
    throw new ManualExternalMarketplaceProviderError('retrieveExternalOrder')
  }
  async retrieveExternalTracking(): Promise<ExternalTrackingInfo> {
    throw new ManualExternalMarketplaceProviderError('retrieveExternalTracking')
  }
}
