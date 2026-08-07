import { describe, it, expect, vi } from 'vitest'
import { selectStoryProducts } from './selectProducts'
import * as imageValidation from './imageValidation'

describe('selectStoryProducts', () => {
  it('siempre devuelve exactamente 6 tarjetas, completando con placeholders si faltan candidatos válidos', async () => {
    vi.spyOn(imageValidation, 'pickValidImage').mockResolvedValue(null)
    const result = await selectStoryProducts([
      { name: 'A', price: 1000, photos: ['x'] },
      { name: 'B', price: 2000, photos: ['y'] },
    ])
    expect(result).toHaveLength(6)
    expect(result.every(p => p.photo === null && p.name === null && p.price === null)).toBe(true)
  })

  it('usa productos reales con imagen válida y se detiene en 6 sin tocar el resto de candidatos', async () => {
    vi.spyOn(imageValidation, 'pickValidImage').mockResolvedValue({ dataUri: 'data:image/jpeg;base64,AAA', mode: 'cover' })
    const candidates = Array.from({ length: 8 }, (_, i) => ({ name: `P${i}`, price: 1000 * i, photos: ['x'] }))
    const result = await selectStoryProducts(candidates)
    expect(result).toHaveLength(6)
    expect(result.every(p => p.photo !== null)).toBe(true)
    expect(result.map(p => p.name)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4', 'P5'])
  })

  it('salta productos sin ninguna imagen válida y sigue con el siguiente candidato', async () => {
    vi.spyOn(imageValidation, 'pickValidImage').mockImplementation(async (photos) => {
      if (photos?.[0] === 'bad') return null
      return { dataUri: 'data:image/jpeg;base64,AAA', mode: 'contain' }
    })
    const candidates = [
      { name: 'Malo1', price: 1, photos: ['bad'] },
      { name: 'Bueno1', price: 2, photos: ['ok'] },
      { name: 'Malo2', price: 3, photos: ['bad'] },
      { name: 'Bueno2', price: 4, photos: ['ok'] },
      { name: 'Bueno3', price: 5, photos: ['ok'] },
      { name: 'Bueno4', price: 6, photos: ['ok'] },
      { name: 'Bueno5', price: 7, photos: ['ok'] },
    ]
    const result = await selectStoryProducts(candidates)
    expect(result.map(p => p.name)).toEqual(['Bueno1', 'Bueno2', 'Bueno3', 'Bueno4', 'Bueno5', null])
  })
})
