import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Listing } from '@/types'
import { CATEGORIES, CONDITION_GROUPS, conditionGroupLabel } from '@/lib/catalog'
import FavoriteButton from '@/components/listings/FavoriteButton'
import ProtectedPrice from '@/components/listings/ProtectedPrice'
import ColorFilterPopover from '@/components/listings/ColorFilterPopover'
import RatingBadge from '@/components/reviews/RatingBadge'
import { getSellerRatings } from '@/lib/reviews'

const SIZES = ['XS','S','M','L','XL','XXL']
const PAGE_SIZE = 48

function getPageRange(current: number, total: number): (number | '…')[] {
  const range: (number | '…')[] = []
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)

  range.push(1)
  if (left > 2) range.push('…')
  for (let i = left; i <= right; i++) range.push(i)
  if (right < total - 1) range.push('…')
  if (total > 1) range.push(total)
  return range
}

const SORT_OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguas', label: 'Más antiguas' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
] as const

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; size?: string; min?: string; max?: string; condition?: string; color?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const page = Math.max(1, parseInt(params.page ?? '1') || 1)

  let query = supabase
    .from('listings')
    .select('*, seller:profiles(id, name, city, avatar_url)', { count: 'exact' })
    .eq('status', 'active')

  if (params.q) {
    // La coma y el paréntesis rompen la gramática del filtro or() de PostgREST,
    // así que se descartan del término en vez de tener que escaparlos.
    const term = params.q.replace(/[,()]/g, ' ').trim()
    if (term) query = query.or(`title.ilike.%${term}%,brand.ilike.%${term}%,description.ilike.%${term}%`)
  }
  if (params.category) query = query.eq('category', params.category)
  if (params.size) query = query.eq('size', params.size)
  if (params.condition) {
    const group = CONDITION_GROUPS.find(g => g.value === params.condition)
    if (group) query = query.in('condition', group.conditions)
  }
  if (params.color) query = query.in('color', params.color.split(','))
  if (params.min) query = query.gte('price', parseInt(params.min))
  if (params.max) query = query.lte('price', parseInt(params.max))

  switch (params.sort) {
    case 'antiguas':
      query = query.order('created_at', { ascending: true })
      break
    case 'precio_asc':
      query = query.order('price', { ascending: true })
      break
    case 'precio_desc':
      query = query.order('price', { ascending: false })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  const [{ data: listings, count }, { data: { user } }] = await Promise.all([
    query.range(from, from + PAGE_SIZE - 1),
    supabase.auth.getUser(),
  ])

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function pageUrl(targetPage: number) {
    const usp = new URLSearchParams()
    if (params.q) usp.set('q', params.q)
    if (params.category) usp.set('category', params.category)
    if (params.size) usp.set('size', params.size)
    if (params.condition) usp.set('condition', params.condition)
    if (params.color) usp.set('color', params.color)
    if (params.min) usp.set('min', params.min)
    if (params.max) usp.set('max', params.max)
    if (params.sort) usp.set('sort', params.sort)
    if (targetPage > 1) usp.set('page', String(targetPage))
    const qs = usp.toString()
    return qs ? `/?${qs}` : '/'
  }

  let favoritedIds = new Set<string>()
  if (user && listings && listings.length > 0) {
    const { data: favorites } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .in('listing_id', listings.map(l => l.id))
    favoritedIds = new Set((favorites ?? []).map(f => f.listing_id))
  }

  const sellerRatings = listings
    ? await getSellerRatings(supabase, listings.map(l => l.seller_id))
    : {}

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      {/* Hero */}
      <div className="bg-black text-white text-center py-10 px-4">
        <p className="text-xs tracking-[6px] text-[#8DA988] uppercase mb-3">Comunidad · Bdress</p>
        <h1 className="mb-2">
          <Image src="/logo-white.png" alt="Bdress Market" width={280} height={93} priority className="mx-auto h-auto w-[220px] sm:w-[280px]" />
        </h1>
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
              placeholder="Marca, título, descripción..."
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
              {CONDITION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>

          <ColorFilterPopover defaultValue={params.color} />

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

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Ordenar por</label>
            <select name="sort" defaultValue={params.sort ?? 'recientes'} className="border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white">
              {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <button type="submit"
            className="bg-black text-white text-[10px] tracking-widest uppercase px-5 py-2 hover:bg-gray-800 transition">
            Filtrar
          </button>

          {(params.q || params.category || params.size || params.condition || params.color || params.min || params.max || params.sort) && (
            <Link href="/" className="text-xs text-gray-400 hover:text-black underline">Limpiar</Link>
          )}
        </div>
      </form>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {listings && listings.length > 0 ? (
          <>
            <p className="text-xs text-gray-400 mb-6">
              {totalCount} {totalCount === 1 ? 'prenda disponible' : 'prendas disponibles'}
            </p>
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
                      {conditionGroupLabel(listing.condition)}
                    </span>
                    <div className="absolute bottom-2 right-2">
                      <FavoriteButton
                        listingId={listing.id}
                        initialFavorited={favoritedIds.has(listing.id)}
                        isLoggedIn={user !== null}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] tracking-widest text-gray-400 uppercase">{listing.brand || 'Sin marca'}</p>
                    <p className="text-sm font-medium truncate mt-0.5">{listing.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">${listing.price.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-gray-400">T. {listing.size}</p>
                    </div>
                    <ProtectedPrice price={listing.price} size="sm" />
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-[10px] text-gray-400">{listing.seller?.name}</p>
                      {sellerRatings[listing.seller_id] && (
                        <RatingBadge rating={sellerRatings[listing.seller_id].avg} count={sellerRatings[listing.seller_id].count} />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center flex-wrap gap-1.5 mt-10">
                <Link
                  href={pageUrl(Math.max(1, page - 1))}
                  aria-disabled={page === 1}
                  className={`px-3 h-9 flex items-center text-xs border border-gray-200 ${
                    page === 1 ? 'pointer-events-none text-gray-300' : 'hover:border-gray-400'
                  }`}
                >
                  ‹ Anterior
                </Link>

                {getPageRange(page, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-300">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={pageUrl(p)}
                      className={`w-9 h-9 flex items-center justify-center text-xs border ${
                        p === page ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                )}

                <Link
                  href={pageUrl(Math.min(totalPages, page + 1))}
                  aria-disabled={page === totalPages}
                  className={`px-3 h-9 flex items-center text-xs border border-gray-200 ${
                    page === totalPages ? 'pointer-events-none text-gray-300' : 'hover:border-gray-400'
                  }`}
                >
                  Siguiente ›
                </Link>
              </div>
            )}
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
