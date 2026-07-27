const GEMINI_API_KEY = process.env.GEMINI_API_KEY!
const MODEL = 'gemini-2.5-flash-image'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export const PHOTO_ENHANCE_ACTIONS = {
  fondo_blanco: {
    label: 'Quitar fondo',
    prompt:
      'Remove the background of this product photo completely and replace it with a solid, pure ' +
      'white background (#FFFFFF), studio product-photo style. Keep the garment exactly as it is — ' +
      'same shape, color, texture, folds, and the shadows/highlights on the item itself — do not ' +
      'alter or retouch the product, only the background. Return only the edited image.',
  },
  iluminacion: {
    label: 'Mejorar iluminación',
    prompt:
      'Improve the lighting and exposure of this product photo: brighten shadows, balance overly ' +
      'dark or overly bright areas, and correct any color cast so the garment\'s true color shows ' +
      'accurately. Do not change the background, the framing, or the garment itself — only the ' +
      'lighting and exposure. Return only the edited image.',
  },
  enderezar: {
    label: 'Enderezar',
    prompt:
      'Straighten this photo: if the garment, hanger line, or horizon is tilted, rotate the image so ' +
      'it is level, cropping only the minimum necessary at the edges to remove the resulting blank ' +
      'corners. Do not change anything else about the photo. Return only the edited image.',
  },
  nitidez: {
    label: 'Aumentar nitidez',
    prompt:
      'Increase the sharpness and clarity of this product photo — bring out fabric texture and detail ' +
      '— without over-sharpening, adding artifacts, or altering the garment\'s color or shape. Return ' +
      'only the edited image.',
  },
} as const

export type PhotoEnhanceAction = keyof typeof PHOTO_ENHANCE_ACTIONS

// Aplica una acción de mejora (quitar fondo, iluminación, enderezar, nitidez)
// sobre una foto de prenda usando Gemini 2.5 Flash Image ("Nano Banana").
// Devuelve el PNG resultante como Buffer.
export async function enhancePhoto(
  imageBuffer: Buffer,
  mimeType: string,
  action: PhotoEnhanceAction
): Promise<Buffer> {
  const { prompt } = PHOTO_ENHANCE_ACTIONS[action]

  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBuffer.toString('base64') } },
        ],
      }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini respondió ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inline_data?: { data?: string } }) => p.inline_data?.data)

  if (!imagePart) {
    throw new Error('Gemini no devolvió una imagen')
  }

  return Buffer.from(imagePart.inline_data.data, 'base64')
}
