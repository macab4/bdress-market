import Anthropic from '@anthropic-ai/sdk'
import { carrierLabel, type CarrierId } from './carrierDetection'

let client: Anthropic | null = null
function getClient() {
  if (!client) client = new Anthropic()
  return client
}

const KNOWN_CARRIER_IDS: CarrierId[] = ['chilexpress', 'starken', 'blueexpress']

const SCHEMA = {
  type: 'object',
  properties: {
    carrier: {
      anyOf: [
        { type: 'string', enum: KNOWN_CARRIER_IDS },
        { type: 'null' },
      ],
    },
    trackingNumber: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
  },
  required: ['carrier', 'trackingNumber'],
  additionalProperties: false,
} as const

export interface LabelExtractionResult {
  carrier: CarrierId | null
  carrierLabel: string | null
  trackingNumber: string | null
}

const EMPTY_RESULT: LabelExtractionResult = { carrier: null, carrierLabel: null, trackingNumber: null }

// Lee una etiqueta de envío (PDF o imagen, escaneada o no) y extrae
// transportista + N.º de seguimiento con Claude. A diferencia de la extracción
// de texto anterior (que solo leía texto incrustado en el PDF), esto también
// funciona con etiquetas que son una imagen sin capa de texto — Claude lee el
// PDF/imagen directamente, no un texto ya extraído.
//
// Misma regla que antes: si no hay certeza razonable, nunca inventar un
// valor — el modelo devuelve null y la admin lo completa a mano.
export async function extractLabelInfo(bytes: Buffer, mediaType: 'application/pdf' | 'image/png' | 'image/jpeg'): Promise<LabelExtractionResult> {
  const contentBlock: Anthropic.Messages.ContentBlockParam = mediaType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: bytes.toString('base64') } }

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        {
          type: 'text',
          text: 'Esta es una etiqueta de envío de un courier chileno. Identifica el transportista '
            + '(chilexpress, starken o blueexpress) y el número de seguimiento/OT impreso en la '
            + 'etiqueta. Si no puedes identificar alguno de los dos con certeza razonable, devuelve '
            + 'null para ese campo — nunca inventes ni adivines un valor.',
        },
      ],
    }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  }).catch(() => null)

  if (!response || response.stop_reason === 'refusal') return EMPTY_RESULT

  const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
  if (!textBlock) return EMPTY_RESULT

  try {
    const parsed = JSON.parse(textBlock.text) as { carrier: CarrierId | null; trackingNumber: string | null }
    return {
      carrier: parsed.carrier,
      carrierLabel: parsed.carrier ? carrierLabel(parsed.carrier) : null,
      trackingNumber: parsed.trackingNumber,
    }
  } catch {
    return EMPTY_RESULT
  }
}

const MEDIA_TYPE_BY_MIME: Record<string, 'application/pdf' | 'image/png' | 'image/jpeg'> = {
  'application/pdf': 'application/pdf',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
}

// Normaliza un content-type (el de un File subido o el de un fetch a Storage)
// al subconjunto que extractLabelInfo soporta — o null si no es un tipo que
// podamos leer.
export function toSupportedMediaType(contentType: string): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  const normalized = contentType.split(';')[0].trim().toLowerCase()
  return MEDIA_TYPE_BY_MIME[normalized] ?? null
}
