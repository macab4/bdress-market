import { describe, it, expect } from 'vitest'
import { bareKey, looseKey, slugifyBrand, classifyBrandGroups, MIN_EVIDENT_BAREKEY_LENGTH } from './brands'

describe('bareKey', () => {
  it('colapsa espacios, guiones y guion bajo, ignora mayúsculas', () => {
    expect(bareKey('The - Are')).toBe('theare')
    expect(bareKey('The- Are')).toBe('theare')
    expect(bareKey('THE-ARE')).toBe('theare')
    expect(bareKey('The Are')).toBe('theare')
    expect(bareKey('the-are')).toBe('theare')
  })

  it('NO ignora acentos — Maje y Majé quedan con bareKey distinto', () => {
    expect(bareKey('Maje')).not.toBe(bareKey('Majé'))
  })
})

describe('looseKey', () => {
  it('sí ignora acentos, a diferencia de bareKey', () => {
    expect(looseKey('Maje')).toBe(looseKey('Majé'))
    expect(looseKey('Cardié')).toBe(looseKey('Cardie'))
  })
})

describe('slugifyBrand', () => {
  it('genera un slug url-safe sin acentos', () => {
    expect(slugifyBrand('THE-ARE')).toBe('the-are')
    expect(slugifyBrand('María Cher')).toBe('maria-cher')
    expect(slugifyBrand('  Top   Shop  ')).toBe('top-shop')
  })

  it('nunca devuelve un slug vacío', () => {
    expect(slugifyBrand('!!!')).toBe('marca')
  })
})

describe('classifyBrandGroups', () => {
  it('agrupa el caso THE-ARE como evidente y elige el más frecuente como canónico', () => {
    const { groupA } = classifyBrandGroups(['THE-ARE', 'THE-ARE', 'THE-ARE', 'THE-ARE', 'The - Are', 'The- Are'])
    expect(groupA).toHaveLength(1)
    expect(groupA[0].canonical).toBe('THE-ARE')
    expect(groupA[0].totalCount).toBe(6)
    expect(groupA[0].variants.map(v => v.raw).sort()).toEqual(['THE-ARE', 'The - Are', 'The- Are'].sort())
  })

  it('NO fusiona Maje y Majé — quedan como dudosos, no como grupo evidente', () => {
    const { groupA, groupB } = classifyBrandGroups(['Maje', 'Majé', 'Majé'])
    expect(groupA).toHaveLength(0)
    expect(groupB).toHaveLength(1)
    expect(groupB[0].map(r => r.raw).sort()).toEqual(['Maje', 'Majé'])
  })

  it('no asume que variantes muy cortas (bareKey corto) son la misma marca', () => {
    const { groupA, singles } = classifyBrandGroups(['AB', 'A B', 'A-B'])
    expect('ab'.length).toBeLessThan(MIN_EVIDENT_BAREKEY_LENGTH)
    expect(groupA).toHaveLength(0)
    expect(singles.length).toBeGreaterThan(0)
  })

  it('una marca sin ninguna variante queda como single, sin tocarla', () => {
    const { groupA, groupB, singles } = classifyBrandGroups(['Zara', 'Mango'])
    expect(groupA).toHaveLength(0)
    expect(groupB).toHaveLength(0)
    expect(singles.map(s => s.raw).sort()).toEqual(['Mango', 'Zara'])
  })
})
