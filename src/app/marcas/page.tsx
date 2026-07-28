import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function BrandsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('listings')
    .select('brand')
    .eq('status', 'active')
    .not('brand', 'eq', '')

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.brand, (counts.get(row.brand) ?? 0) + 1)
  }
  const brands = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className="hover:text-black">Inicio</Link> / Marcas
        </p>
        <h1 className="font-serif text-xl mb-6">Marcas</h1>

        {brands.length > 0 ? (
          <div className="bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 divide-y divide-gray-100">
            {brands.map(([brand, count]) => (
              <Link key={brand} href={`/?brand=${encodeURIComponent(brand)}`}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                <span className="text-sm truncate">{brand}</span>
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
