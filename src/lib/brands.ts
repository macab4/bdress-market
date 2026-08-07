// Modelo de marca canónica (brand_id) — ver supabase/migrations/20260807000000_brand_canonical_model.sql.
//
// IMPORTANTE (pedido explícito): la normalización NUNCA decide identidad
// de marca por similitud. Solo sirve para:
//   - detectar candidatos a duplicado (para un reporte, nunca para fusionar solo);
//   - hacer match exacto contra un alias o normalized_name YA REGISTRADO
//     (eso sí es seguro: es texto idéntico salvo formato, no una suposición);
//   - alimentar búsqueda/autocomplete.
// La fuente de verdad de qué producto es de qué marca es siempre brand_id
// (o, para listings todavía no migrados, el texto crudo de `brand`).
//
// Este archivo es nuevo — src/lib/catalog.ts sigue teniendo normalizeBrand/
// brandSlug/groupBrands intactas para todo lo que aún no se migró a
// brand_id (compatibilidad hacia atrás, sin romper nada existente).

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

// Clave de identidad "evidente": minúsculas, sin espacios/guiones/guion
// bajo, SIN normalizar acentos. Dos textos con el mismo bareKey difieren
// solo en formato (mayúsculas, espacios, guiones) — es la única regla que
// se usa para fusionar automáticamente en la migración (sección 5 del
// encargo: "equivalencias evidentes"). "Maje" y "Majé" a propósito NO
// comparten bareKey (conservan el acento), así que nunca se fusionan solo
// por esto.
export function bareKey(input: string): string {
  return input.trim().toLowerCase().replace(/[\s\-_]+/g, '')
}

// Igual que bareKey pero además ignora acentos — solo para señalar
// candidatos dudosos en el reporte de migración (sección 5: "equivalencias
// dudosas"). Nunca se usa para fusionar ni para resolver brand_id.
export function looseKey(input: string): string {
  return bareKey(input).normalize('NFD').replace(COMBINING_DIACRITICS, '')
}

// Solo un texto muy corto (ej. "AB" / "A B" / "A-B") es demasiado ambiguo
// para asumir que la diferencia es solo de formato — el encargo pide
// explícitamente no asumir eso universalmente. Por debajo de este largo,
// un grupo por bareKey queda marcado como dudoso en vez de evidente,
// aunque técnicamente comparta bareKey.
export const MIN_EVIDENT_BAREKEY_LENGTH = 4

// Slug URL-safe a partir del nombre visible — a diferencia de bareKey/
// normalized_name, el slug SÍ elimina acentos (convención estándar de
// URLs) y no tiene por qué coincidir con la clave de identidad.
export function slugifyBrand(displayName: string): string {
  const base = displayName
    .normalize('NFD').replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'marca'
}

export interface BrandOption {
  id: string
  display_name: string
  slug: string
}

export interface BrandVariant { raw: string; count: number }
export interface EvidentGroup { bareKey: string; canonical: string; variants: BrandVariant[]; totalCount: number }
export interface DudosaCandidate { bareKey: string; raw: string; totalCount: number }

// Misma lógica usada por el script de migración (supabase/ — ver reporte
// de duplicados) — se deja acá también, tested, para reutilizarla desde
// el panel admin u otras herramientas más adelante. Nunca fusiona: solo
// clasifica candidatos en evidente (mismo bareKey, formato suficientemente
// largo) vs. dudoso (mismo looseKey pero distinto bareKey — típicamente
// una diferencia de acentos).
export function classifyBrandGroups(rawBrands: string[]): {
  groupA: EvidentGroup[]
  groupB: DudosaCandidate[][]
  singles: { bareKey: string; raw: string; count: number }[]
} {
  const byBareKey = new Map<string, Map<string, number>>()
  for (const raw of rawBrands) {
    const key = bareKey(raw)
    if (!byBareKey.has(key)) byBareKey.set(key, new Map())
    const variants = byBareKey.get(key)!
    variants.set(raw, (variants.get(raw) ?? 0) + 1)
  }

  const groupA: EvidentGroup[] = []
  const singles: { bareKey: string; raw: string; count: number }[] = []

  for (const [key, variants] of byBareKey.entries()) {
    const variantList: BrandVariant[] = Array.from(variants.entries()).map(([raw, count]) => ({ raw, count }))
    if (variantList.length > 1 && key.length >= MIN_EVIDENT_BAREKEY_LENGTH) {
      const sorted = [...variantList].sort((a, b) => b.count - a.count)
      groupA.push({ bareKey: key, canonical: sorted[0].raw, variants: sorted, totalCount: sorted.reduce((a, v) => a + v.count, 0) })
    } else {
      for (const v of variantList) singles.push({ bareKey: key, raw: v.raw, count: v.count })
    }
  }

  const representatives: DudosaCandidate[] = [
    ...groupA.map(g => ({ bareKey: g.bareKey, raw: g.canonical, totalCount: g.totalCount })),
    ...singles.map(s => ({ bareKey: s.bareKey, raw: s.raw, totalCount: s.count })),
  ]
  const byLooseKey = new Map<string, DudosaCandidate[]>()
  for (const rep of representatives) {
    const lk = looseKey(rep.raw)
    if (!byLooseKey.has(lk)) byLooseKey.set(lk, [])
    byLooseKey.get(lk)!.push(rep)
  }
  const groupB = Array.from(byLooseKey.values()).filter(reps => new Set(reps.map(r => r.bareKey)).size > 1)

  return { groupA, groupB, singles }
}
