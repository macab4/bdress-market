import { pickValidImage } from './imageValidation'
import type { StoryProduct } from './template'

export interface ProductCandidate {
  name: string
  price: number
  photos: string[]
}

const TARGET_COUNT = 6
const IMAGE_TIMEOUT_MS = 4000

// Orden de fallback pedido en el encargo: prueba cada candidato en orden de
// llegada (ya viene ordenado por más reciente primero), y para cada uno
// prueba sus fotos en orden hasta encontrar una válida (ver pickValidImage).
// Si un candidato no tiene ninguna foto que cargue, se descarta por completo
// y se pasa al siguiente — nunca se deja un espacio vacío por su culpa.
export async function selectStoryProducts(candidates: ProductCandidate[]): Promise<StoryProduct[]> {
  const selected: StoryProduct[] = []

  for (const candidate of candidates) {
    if (selected.length >= TARGET_COUNT) break

    const photo = await pickValidImage(candidate.photos, IMAGE_TIMEOUT_MS)
    if (!photo) {
      console.warn(`[instagram-story] producto sin ninguna foto válida, se descarta: "${candidate.name}"`)
      continue
    }
    selected.push({ name: candidate.name, price: candidate.price, photo })
  }

  // Último recurso, solo si tras revisar TODOS los candidatos siguen
  // faltando tarjetas: placeholder de marca, nunca un rectángulo negro vacío.
  while (selected.length < TARGET_COUNT) {
    selected.push({ name: null, price: null, photo: null })
  }

  return selected
}
