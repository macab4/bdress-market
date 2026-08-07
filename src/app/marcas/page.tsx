import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { groupBrands } from '@/lib/catalog'

interface BrandGroup {
  slug: string
  label: string
  count: number
}

export default async function BrandsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('brand, brand_id, brand_ref:brands(id, display_name, slug)')
    .eq('status', 'active')
    .not('brand', 'eq', '')

  const rows = data ?? []

  // Gradual: los listings ya migrados (brand_id asignado) se agrupan por
  // marca canónica de verdad. Los que todavía no (brand_id null) caen al
  // agrupamiento viejo por texto — después del backfill esto queda vacío
  // solo, sin tener que tocar esta página de nuevo (ver src/lib/brands.ts).
  const migrated = rows.filter(r => r.brand_id && r.brand_ref)
  const legacy = rows.filter(r => !r.brand_id)

  const byBrandId = new Map<string, BrandGroup>()
  for (const r of migrated) {
    const ref = Array.isArray(r.brand_ref) ? r.brand_ref[0] : r.brand_ref
    if (!ref) continue
    const existing = byBrandId.get(ref.id)
    if (existing) existing.count++
    else byBrandId.set(ref.id, { slug: ref.slug, label: ref.display_name, count: 1 })
  }

  const legacyGroups: BrandGroup[] = groupBrands(legacy.map(r => r.brand))

  const brands = [...byBrandId.values(), ...legacyGroups].sort((a, b) => a.label.localeCompare(b.label, 'es'))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className="hover:text-black">Inicio</Link> / Marcas
        </p>
        <h1 className="font-serif text-xl mb-6">Marcas</h1>

        {brands.length > 0 ? (
          <div className="bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 divide-y divide-gray-100">
            {brands.map(({ slug, label, count }) => (
              <Link key={slug} href={`/?brand=${slug}`}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                <span className="text-sm truncate">{label}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{count}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 text-center">
            <p className="text-gray-400 text-sm">Todavía no hay marcas registradas.</p>
          </div>
        )}
      </div>
    </div>
  )
}
