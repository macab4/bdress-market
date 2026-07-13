import comunas from '@/lib/chilexpress-comunas.json'
import { ListingShippingSize } from '@/types'

const RATING_URL = 'http://testservices.wschilexpress.com/rating/api/v1.0/rates/business'
const TRANSPORT_ORDERS_URL = 'http://testservices.wschilexpress.com/transport-orders/api/v1.0/transport-orders'

const COTIZADOR_KEY = process.env.CHILEXPRESS_COTIZADOR_KEY!
const ENVIOS_KEY = process.env.CHILEXPRESS_ENVIOS_KEY!
const TCC = process.env.CHILEXPRESS_TCC!

// Dimensiones/peso aproximados por tamaño de envío declarado al publicar la prenda
const PACKAGE_BY_SIZE: Record<ListingShippingSize, { weight: string; height: string; width: string; length: string }> = {
  pequeno: { weight: '0.5', height: '5', width: '20', length: '30' },
  mediano: { weight: '1.5', height: '15', width: '25', length: '30' },
  grande: { weight: '3', height: '25', width: '35', length: '40' },
}

export function findCountyCode(comunaName: string): string | null {
  const needle = comunaName.trim().toUpperCase()
  return comunas.find(c => c.name === needle)?.code ?? null
}

interface QuoteResult {
  serviceCode: string
  serviceDescription: string
  price: number
}

export async function getShippingQuote({
  originComuna,
  destComuna,
  size,
  declaredValue,
}: {
  originComuna: string
  destComuna: string
  size: ListingShippingSize
  declaredValue: number
}): Promise<QuoteResult | null> {
  const originCode = findCountyCode(originComuna)
  const destCode = findCountyCode(destComuna)
  if (!originCode || !destCode) return null

  const pkg = PACKAGE_BY_SIZE[size]

  const res = await fetch(RATING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': COTIZADOR_KEY,
    },
    body: JSON.stringify({
      originCountyCode: originCode,
      destinationCountyCode: destCode,
      package: pkg,
      productType: 3,
      contentType: 4, // Vestuario
      declaredWorth: String(declaredValue),
      deliveryTime: 0,
      customerCardNumber: TCC,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const options = data?.data?.courierServiceOptions
  if (!options || options.length === 0) return null

  // Elegimos la opción más barata disponible
  const cheapest = options.reduce((min: typeof options[0], o: typeof options[0]) =>
    parseInt(o.serviceValueDiscount ?? o.serviceValue) < parseInt(min.serviceValueDiscount ?? min.serviceValue) ? o : min
  )

  return {
    serviceCode: String(cheapest.serviceTypeCode),
    serviceDescription: cheapest.serviceDescription,
    price: parseInt(cheapest.serviceValueDiscount ?? cheapest.serviceValue),
  }
}

interface CreateShipmentParams {
  originComuna: string
  destComuna: string
  destStreetName: string
  destStreetNumber: string
  destSupplement: string
  senderName: string
  senderPhone: string
  senderEmail: string
  recipientName: string
  recipientPhone: string
  recipientEmail: string
  size: ListingShippingSize
  serviceCode: string
  declaredValue: number
  reference: string
}

interface ShipmentResult {
  trackingNumber: string
  barcode: string
  labelBase64: string
}

export async function createShipment(params: CreateShipmentParams): Promise<ShipmentResult | { error: string }> {
  const originCode = findCountyCode(params.originComuna)
  const destCode = findCountyCode(params.destComuna)
  if (!originCode || !destCode) return { error: 'Comuna no reconocida por Chilexpress' }

  const pkg = PACKAGE_BY_SIZE[params.size]

  const res = await fetch(TRANSPORT_ORDERS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': ENVIOS_KEY,
    },
    body: JSON.stringify({
      header: {
        certificateNumber: 0,
        customerCardNumber: TCC,
        countyOfOriginCoverageCode: originCode,
        labelType: 2, // imagen binaria + datos
      },
      details: [{
        addresses: [
          {
            countyCoverageCode: destCode,
            streetName: params.destStreetName,
            streetNumber: params.destStreetNumber,
            supplement: params.destSupplement,
            addressType: 'DEST',
            deliveryOnCommercialOffice: false,
            observation: '',
          },
        ],
        contacts: [
          { name: params.senderName, phoneNumber: params.senderPhone, mail: params.senderEmail, contactType: 'R' },
          { name: params.recipientName, phoneNumber: params.recipientPhone, mail: params.recipientEmail, contactType: 'D' },
        ],
        packages: [{
          ...pkg,
          serviceDeliveryCode: params.serviceCode,
          productCode: 3,
          deliveryReference: params.reference,
          groupReference: params.reference,
          declaredValue: String(params.declaredValue),
          declaredContent: 4,
          receivableAmountInDelivery: 0,
        }],
      }],
    }),
  })

  const data = await res.json()
  const detail = data?.data?.detail?.[0]

  if (!res.ok || !detail) {
    return { error: data?.statusDescription || 'Error al generar el envío en Chilexpress' }
  }

  return {
    trackingNumber: String(detail.transportOrderNumber),
    barcode: detail.barcode,
    labelBase64: detail.label?.labelData ?? '',
  }
}
