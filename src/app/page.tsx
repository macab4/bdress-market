import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Listing } from '@/types'
import { CATEGORIES, CONDITIONS, conditionLabel } from '@/lib/catalog'

const SIZES = ['XS','S','M','L','XL','XXL']

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; size?: string; min?: string; max?: string; condition?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('listings')
    .select('*, seller:profiles(id, name, city, avatar_url)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (params.q) query = query.ilike('title', `%${params.q}%`)
  if (params.category) query = query.eq('category', params.category)
  if (params.size) query = query.eq('size', params.size)
  if (params.condition) query = query.eq('condition', params.condition)
  if (params.min) query = query.gte('price', parseInt(params.min))
  if (params.max) query = query.lte('price', parseInt(params.max))

  const { data: listings } = await query.limit(48)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      {/* Hero */}
      <div className="bg-black text-white text-center py-10 px-4">
        <p className="text-xs tracking-[6px] text-[#8DA988] uppercase mb-3">Comunidad · Bdress</p>
        <h1 className="text-3xl font-light tracking-widest uppercase mb-2">Bdress Market</h1>
        <p className="text-sm text-gray-400">Compra y vende prendas de la comunidad Bdress</p>
      </div>

      {/* Filtros */}
      <form method="GET" className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Buscar</label>
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Marca, título..."
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Categoría</label>
            <select name="category" defaultValue={params.category} className="border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white">
              <option value="">Todas</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Talla</label>
            <select name="size" defaultValue={params.size} className="border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white">
              <option value="">Todas</option>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Estado</label>
            <select name="condition" defaultValue={params.condition} className="border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white">
              <option value="">Todos</option>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Precio mín.</label>
            <input name="min" defaultValue={params.min} placeholder="$0" type="number"
              className="w-24 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Precio máx.</label>
            <input name="max" defaultValue={params.max} placeholder="$999.999" type="number"
              className="w-24 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          <button type="submit"
            className="bg-black text-white text-[10px] tracking-widest uppercase px-5 py-2 hover:bg-gray-800 transition">
            Filtrar
          </button>

          {(params.q || params.category || params.size || params.condition || params.min || params.max) && (
            <Link href="/" className="text-xs text-gray-400 hover:text-black underline">Limpiar</Link>
          )}
        </div>
      </form>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {listings && listings.length > 0 ? (
          <>
            <p className="text-xs text-gray-400 mb-6">{listings.length} prendas disponibles</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(listings as (Listing & { seller: { name: string; city: string } })[]).map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="group bg-white">
                  <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
                    {listing.photos[0] ? (
                      <Image
                        src={listing.photos[0]}
                        alt={listing.title}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                        Sin foto
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-white text-[9px] tracking-widest uppercase px-2 py-1">
                      {conditionLabel(listing.condition)}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] tracking-widest text-gray-400 uppercase">{listing.brand || 'Sin marca'}</p>
                    <p className="text-sm font-medium truncate mt-0.5">{listing.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm font-semibold">${listing.price.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-gray-400">T. {listing.size}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{listing.seller?.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No hay prendas que coincidan con tu búsqueda.</p>
            <Link href="/" className="text-[#8DA988] text-xs underline mt-2 inline-block">Ver todas</Link>
          </div>
        )}
      </div>
    </div>
  )
}
