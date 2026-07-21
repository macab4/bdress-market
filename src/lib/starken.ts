import citiesOrigin from '@/lib/starken-cities-origin.json'
import citiesDestino from '@/lib/starken-cities-destino.json'
import { ListingShippingSize } from '@/types'

const QUOTE_URL = 'https://restservices-qa.starken.cl/apiqa/starkenservices/rest/consultarTarifas'
const EMISION_URL = 'https://emisionh2h-qa.starken.cl/starkenh2h/servlet/aemisionh2hremrest'
const LABEL_URL = 'https://apiqa.starken.cl/apiqa/etiqueta/impresionByOrdenFleteDynamic'

const STARKEN_RUT = process.env.STARKEN_RUT!
const STARKEN_CLAVE = process.env.STARKEN_CLAVE!

const EMISION_RUT_EMPRESA = process.env.STARKEN_EMISION_RUT_EMPRESA!
const EMISION_DV_EMPRESA = process.env.STARKEN_EMISION_DV_EMPRESA!
const EMISION_RUT_USUARIO = process.env.STARKEN_EMISION_RUT_USUARIO!
const EMISION_CLAVE_USUARIO = process.env.STARKEN_EMISION_CLAVE_USUARIO!
const CTA_CORRIENTE = process.env.STARKEN_CTA_CORRIENTE!
const CTA_CORRIENTE_DV = process.env.STARKEN_CTA_CORRIENTE_DV!
const CENTRO_COSTO = process.env.STARKEN_CENTRO_COSTO!

const LABEL_USER = process.env.STARKEN_LABEL_USER!
const LABEL_PASSWORD = process.env.STARKEN_LABEL_PASSWORD!

const DOMICILIO = 2 // codigoTipoEntrega — la compradora recibe en su dirección, no retira en sucursal

// Dimensiones/peso aproximados por tamaño de envío declarado al publicar la prenda
const PACKAGE_BY_SIZE: Record<ListingShippingSize, { alto: number; ancho: number; largo: number; kilos: number }> = {
  pequeno: { alto: 5, ancho: 20, largo: 30, kilos: 0.5 },
  mediano: { alto: 15, ancho: 25, largo: 30, kilos: 1.5 },
  grande: { alto: 25, ancho: 35, largo: 40, kilos: 3 },
}

function findCityCode(comunaName: string, list: typeof citiesOrigin): number | null {
  const needle = comunaName.trim().toUpperCase()
  for (const city of list) {
    if (city.comunas.some(c => c.nombreComuna === needle)) return city.codigoCiudad
  }
  return null
}

export function findOriginCityCode(comunaName: string): number | null {
  return findCityCode(comunaName, citiesOrigin)
}

export function findDestCityCode(comunaName: string): number | null {
  return findCityCode(comunaName, citiesDestino)
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
}: {
  originComuna: string
  destComuna: string
  size: ListingShippingSize
  declaredValue: number
}): Promise<QuoteResult | null> {
  const origenCode = findOriginCityCode(originComuna)
  const destinoCode = findDestCityCode(destComuna)
  if (!origenCode || !destinoCode) return null

  const pkg = PACKAGE_BY_SIZE[size]

  const res = await fetch(QUOTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8', rut: STARKEN_RUT, clave: STARKEN_CLAVE },
    body: JSON.stringify({
      codigoCiudadOrigen: origenCode,
      codigoCiudadDestino: destinoCode,
      codigoAgenciaOrigen: 0,
      codigoAgenciaDestino: 0,
      alto: pkg.alto,
      ancho: pkg.ancho,
      largo: pkg.largo,
      kilos: pkg.kilos,
      cuentaCorriente: '',
      cuentaCorrienteDV: '',
      rutCliente: STARKEN_RUT,
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const tarifas: Array<{
    costoTotal: number
    tipoEntrega: { codigoTipoEntrega: number; descripcionTipoEntrega: string }
    tipoServicio: { codigoTipoServicio: number; descripcionTipoServicio: string }
  }> = data?.listaTarifas ?? []

  // Solo entrega a domicilio — no queremos que la compradora tenga que ir a retirar a una sucursal
  const domicilio = tarifas.filter(t => t.tipoEntrega.codigoTipoEntrega === DOMICILIO)
  if (domicilio.length === 0) return null

  const cheapest = domicilio.reduce((min, t) => (t.costoTotal < min.costoTotal ? t : min))

  return {
    serviceCode: String(cheapest.tipoServicio.codigoTipoServicio),
    serviceDescription: cheapest.tipoServicio.descripcionTipoServicio,
    price: Math.round(cheapest.costoTotal),
  }
}

// Starken exige la numeración de la dirección en un campo aparte, pero acá
// las direcciones se guardan como un solo texto libre (ej. "Bernardo Ohiggins 152")
// — se extrae el número final de la calle con esta heurística.
function splitStreetAddress(address: string): { street: string; number: string } {
  const match = address.trim().match(/^(.*?)\s+(\d+[A-Za-z]?)\s*$/)
  if (!match) return { street: address.trim(), number: 'S/N' }
  return { street: match[1].trim(), number: match[2] }
}

interface CreateShipmentParams {
  originComuna: string
  originStreetName: string
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
  declaredValue: number
  reference: string
}

interface ShipmentResult {
  trackingNumber: string
  barcode: string | null
}

export async function createShipment(params: CreateShipmentParams): Promise<ShipmentResult | { error: string }> {
  const pkg = PACKAGE_BY_SIZE[params.size]
  const origin = splitStreetAddress(params.originStreetName)
  const dest = params.destStreetNumber
    ? { street: params.destStreetName, number: params.destStreetNumber }
    : splitStreetAddress(params.destStreetName)

  const res = await fetch(EMISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({
      rutEmpresaEmisora: EMISION_RUT_EMPRESA,
      rutUsuarioEmisor: EMISION_RUT_USUARIO,
      claveUsuarioEmisor: EMISION_CLAVE_USUARIO,
      rutRemitente: EMISION_RUT_EMPRESA,
      dvRemitente: EMISION_DV_EMPRESA,
      nombreRazonSocialRemitente: params.senderName,
      apellidoPaternoRemitente: '.',
      apellidoMaternoRemitente: '.',
      direccionRemitente: origin.street,
      numeracionDireccionRemitente: origin.number,
      departamentoRemitente: '',
      emailRemitente: params.senderEmail,
      telefonoRemitente: params.senderPhone,
      comunaRemitente: params.originComuna.toUpperCase(),
      rutDestinatario: '',
      dvRutDestinatario: '',
      nombreRazonSocialDestinatario: params.recipientName,
      apellidoPaternoDestinatario: '.',
      apellidoMaternoDestinatario: '.',
      direccionDestinatario: dest.street,
      numeracionDireccionDestinatario: dest.number,
      departamentoDireccionDestinatario: params.destSupplement,
      comunaDestino: params.destComuna.toUpperCase(),
      telefonoDestinatario: params.recipientPhone,
      emailDestinatario: params.recipientEmail,
      nombreContactoDestinatario: params.recipientName,
      tipoEntrega: DOMICILIO,
      tipoPago: '2',
      numeroCtaCte: CTA_CORRIENTE,
      dvNumeroCtaCte: CTA_CORRIENTE_DV,
      centroCostoCtaCte: CENTRO_COSTO,
      valorDeclarado: String(params.declaredValue),
      contenido: 'VESTUARIO',
      kilosTotal: String(pkg.kilos),
      alto: String(pkg.alto),
      ancho: String(pkg.ancho),
      largo: String(pkg.largo),
      tipoServicio: '0',
      tipoEncargo1: '29',
      cantidadEncargo1: '1',
      observacion: `Bdress Market — pedido ${params.reference}`,
    }),
  })

  const data = await res.json()

  if (!res.ok || data?.codigoError !== 0 || !data?.nroOrdenFlete) {
    return { error: data?.descripcionError || 'Error al generar el envío en Starken' }
  }

  return {
    trackingNumber: String(Math.round(Number(data.nroOrdenFlete))),
    barcode: data?.Encargos?.[0]?.codigoBarraEncargo ?? null,
  }
}

const LABEL_TIPO_SALIDA_PDF = 3 // PDF, tamaño hoja carta

// Devuelve el PDF de la etiqueta ya descargado (bytes), listo para subir a
// nuestro propio storage — el servicio de Starken entrega primero una URL
// firmada y hay que volver a pedirla con la misma autenticación.
export async function getShipmentLabel(trackingNumber: string): Promise<Buffer | null> {
  const auth = Buffer.from(`${LABEL_USER}:${LABEL_PASSWORD}`).toString('base64')

  const res = await fetch(`${LABEL_URL}?ordenFlete=${trackingNumber}&tipoSalida=${LABEL_TIPO_SALIDA_PDF}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
  })

  if (!res.ok) return null
  const data = await res.json()
  const pdfUrl = data?.data?.[0]
  if (data?.status !== 200 || !pdfUrl) return null

  const pdfRes = await fetch(pdfUrl, { headers: { Authorization: `Basic ${auth}` } })
  if (!pdfRes.ok) return null

  return Buffer.from(await pdfRes.arrayBuffer())
}
