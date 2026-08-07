import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { Listing } from '@/types'
import { CONDITION_GROUPS, conditionGroupLabel, departmentEntry, productCategoryLabel, groupBrands } from '@/lib/catalog'
import { INTERNATIONAL_BADGE_LABEL } from '@/lib/international/content'
import FavoriteButton from '@/components/listings/FavoriteButton'
import ProtectedPrice from '@/components/listings/ProtectedPrice'
import CatalogFilters from '@/components/listings/CatalogFilters'
import SaveSearchButton from '@/components/listings/SaveSearchButton'
import RatingBadge from '@/components/reviews/RatingBadge'
import { getSellerRatings } from '@/lib/reviews'

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

interface HomeSearchParams {
  q?: string; category?: string; productCategory?: string; productType?: string
  size?: string; brand?: string; min?: string; max?: string; condition?: string; color?: string
  material?: string; occasion?: string; length?: string; sort?: string; page?: string
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>
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
    if (term) query = query.or(`title.ilike.%${term}%,brand.ilike.%${term}%,description.ilike.%${term}%,material.ilike.%${term}%,style.ilike.%${term}%`)
  }
  if (params.category) query = query.eq('category', params.category)
  if (params.productCategory) query = query.eq('product_category', params.productCategory)
  if (params.productType) query = query.eq('product_type', params.productType)
  if (params.size) query = query.eq('size', params.size)

  // La marca es texto libre al publicar (puede haber "María Cher" / "Maria
  // Cher" / "MARIA CHER" para la misma marca) — el filtro llega como un slug
  // normalizado (ver brandSlug en catalog.ts) y se resuelve contra todas las
  // variantes de escritura que existan hoy antes de filtrar.
  let brandGroup: { slug: string; label: string; variants: string[] } | undefined
  if (params.brand) {
    const { data: brandRows } = await supabase.from('listings').select('brand').eq('status', 'active').not('brand', 'eq', '')
    brandGroup = groupBrands((brandRows ?? []).map(r => r.brand)).find(g => g.slug === params.brand)
    query = query.in('brand', brandGroup ? brandGroup.variants : ['__sin_coincidencia__'])
  }
  if (params.condition) {
    const group = CONDITION_GROUPS.find(g => g.value === params.condition)
    if (group) query = query.in('condition', group.conditions)
  }
  if (params.color) query = query.overlaps('colors', params.color.split(','))
  if (params.material) query = query.eq('material', params.material)
  if (params.occasion) query = query.overlaps('occasion', params.occasion.split(','))
  if (params.length) query = query.eq('length', params.length)
  if (params.min) query = query.gte('price', parseInt(params.min))
  if (params.max) query = query.lte('price', parseInt(params.max))

  // "Más guardados" no tiene una columna que ordenar directamente en la base
  // de datos (no se agregó un contador a favorites para no tocar ese
  // sistema) — se resuelve trayendo los ids que matchean el resto de los
  // filtros, contando sus favoritos aparte (solo lectura) y paginando en
  // memoria. Con el tamaño actual del catálogo esto es liviano; si el
  // catálogo crece mucho, esto debería pasar a una columna contador.
  type ListingWithSeller = Listing & { seller: { name: string; city: string } }
  let listings: ListingWithSeller[] | null = null
  let totalCount = 0

  if (params.sort === 'guardados') {
    const { data: matchIds } = await query.select('id')
    const ids = (matchIds ?? []).map(r => r.id)
    totalCount = ids.length

    let orderedIds = ids
    if (ids.length > 0) {
      const { data: favRows } = await supabase.from('favorites').select('listing_id').in('listing_id', ids)
      const counts = new Map<string, number>()
      for (const row of favRows ?? []) counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1)
      orderedIds = [...ids].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    }
    const from = (page - 1) * PAGE_SIZE
    const pageIds = orderedIds.slice(from, from + PAGE_SIZE)
    if (pageIds.length > 0) {
      const { data } = await supabase
        .from('listings')
        .select('*, seller:profiles(id, name, city, avatar_url)')
        .in('id', pageIds)
      const byId = new Map((data ?? []).map(l => [l.id, l]))
      listings = pageIds.map(id => byId.get(id)).filter((l): l is ListingWithSeller => !!l)
    } else {
      listings = []
    }
  } else {
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
        query = query.order('bumped_at', { ascending: false })
    }
    const from = (page - 1) * PAGE_SIZE
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1)
    listings = data as typeof listings
    totalCount = count ?? 0
  }

  const isDefaultView = page === 1 && !params.q && !params.category && !params.productCategory && !params.productType &&
    !params.size && !params.brand && !params.condition && !params.color && !params.material && !params.occasion &&
    !params.length && !params.min && !params.max && !params.sort

  const [{ data: { user } }, { data: featuredListings }] = await Promise.all([
    supabase.auth.getUser(),
    isDefaultView
      ? supabase
          .from('listings')
          .select('*, seller:profiles(id, name, city, avatar_url)')
          .eq('status', 'active')
          .gt('featured_until', new Date().toISOString())
          .order('featured_until', { ascending: false })
          .limit(8) as unknown as Promise<{ data: (Listing & { seller: { name: string; city: string } })[] | null }>
      : Promise.resolve({ data: null }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  function pageUrl(targetPage: number) {
    const usp = new URLSearchParams()
    if (params.q) usp.set('q', params.q)
    if (params.category) usp.set('category', params.category)
    if (params.productCategory) usp.set('productCategory', params.productCategory)
    if (params.productType) usp.set('productType', params.productType)
    if (params.size) usp.set('size', params.size)
    if (params.brand) usp.set('brand', params.brand)
    if (params.condition) usp.set('condition', params.condition)
    if (params.color) usp.set('color', params.color)
    if (params.material) usp.set('material', params.material)
    if (params.occasion) usp.set('occasion', params.occasion)
    if (params.length) usp.set('length', params.length)
    if (params.min) usp.set('min', params.min)
    if (params.max) usp.set('max', params.max)
    if (params.sort) usp.set('sort', params.sort)
    if (targetPage > 1) usp.set('page', String(targetPage))
    const qs = usp.toString()
    return qs ? `/?${qs}` : '/'
  }

  const dept = params.category ? departmentEntry(params.category) : undefined
  const pcLabel = dept && params.productCategory ? productCategoryLabel(params.category!, params.productCategory) : null
  const breadcrumbParts = dept?.label
    ? [dept.label, pcLabel, params.productType].filter(Boolean)
    : brandGroup ? ['Marcas', brandGroup.label] : []
  const pageTitle = params.productType || pcLabel || dept?.label || brandGroup?.label || 'Todas las prendas'

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
        <p className="text-xs tracking-[6px] text-[#7fab87] uppercase mb-3">Comunidad · Bdress</p>
        <h1 className="mb-2">
          <Image src="/logo-white.png" alt="Bdress Market" width={280} height={93} priority className="mx-auto h-auto w-[220px] sm:w-[280px]" />
        </h1>
        <p className="text-sm text-gray-400">Compra y vende prendas de la comunidad Bdress</p>
      </div>

      {/* Filtros */}
      <CatalogFilters />

      {/* Destacadas */}
      {featuredListings && featuredListings.length > 0 && (
        <div className="max-w-5xl mx-auto px-4 pt-8">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">Destacadas</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featuredListings.map((listing) => (
              <Link key={listing.id} href={`/listings/${listing.id}`} className="group bg-white flex-shrink-0 w-36">
                <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
                  {listing.photos[0] ? (
                    <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover group-hover:scale-105 transition duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                  )}
                  <span className="absolute top-2 left-2 bg-[#7fab87] text-white text-[9px] tracking-widest uppercase px-2 py-1">
                    Destacada
                  </span>
                  {listing.source_type === 'international_on_demand' && (
                    <span className="absolute top-2 right-2 bg-black/80 text-white text-[9px] tracking-widest uppercase px-2 py-1">
                      {INTERNATIONAL_BADGE_LABEL}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] tracking-widest text-gray-400 uppercase truncate">{listing.brand || 'Sin marca'}</p>
                  <p className="text-xs font-medium truncate">{listing.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">${listing.price.toLocaleString('es-CL')}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {(breadcrumbParts.length > 0 || (user && !isDefaultView)) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            {breadcrumbParts.length > 0 ? (
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">
                  <Link href="/" className="hover:text-black">Inicio</Link>
                  {breadcrumbParts.map((part, i) => <span key={i}> / {part}</span>)}
                </p>
                <h1 className="font-serif text-xl">{pageTitle}</h1>
              </div>
            ) : <div />}
            {user && !isDefaultView && <SaveSearchButton />}
          </div>
        )}
        {listings && listings.length > 0 ? (
          <>
            <p className="text-xs text-gray-400 mb-6">
              {totalCount} {totalCount === 1 ? 'prenda disponible' : 'prendas disponibles'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/listings/${listing.id}`} className="group bg-white">
                  <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
                    {listing.photos[0] ? (
                      <>
                        <Image
                          src={listing.photos[0]}
                          alt={listing.title}
                          fill
                          className={`object-cover transition duration-300 ${
                            listing.photos[1] ? 'group-hover:opacity-0' : 'group-hover:scale-105'
                          }`}
                        />
                        {listing.photos[1] && (
                          <Image
                            src={listing.photos[1]}
                            alt={listing.title}
                            fill
                            className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300"
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                        Sin foto
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                      <span className="bg-white text-[9px] tracking-widest uppercase px-2 py-1">
                        {conditionGroupLabel(listing.condition)}
                      </span>
                      {listing.featured_until && new Date(listing.featured_until) > new Date() && (
                        <span className="bg-[#7fab87] text-white text-[9px] tracking-widest uppercase px-2 py-1">
                          Destacada
                        </span>
                      )}
                      {listing.source_type === 'international_on_demand' && (
                        <span className="bg-black/80 text-white text-[9px] tracking-widest uppercase px-2 py-1">
                          {INTERNATIONAL_BADGE_LABEL}
                        </span>
                      )}
                    </div>
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
                      <p className="text-[10px] text-gray-400">{listing.size}</p>
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
                        p === page ? 'border-[#7fab87] bg-[#7fab87] text-white' : 'border-gray-200 hover:border-gray-400'
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
            <p className="text-gray-700 text-sm font-medium">No encontramos prendas con estos filtros.</p>
            <p className="text-gray-400 text-xs mt-1">Prueba eliminando algunos filtros o revisa todas las prendas disponibles.</p>
            <Link href="/" className="text-[#7fab87] text-xs underline mt-3 inline-block">Ver todas las prendas</Link>
          </div>
        )}
      </div>
    </div>
  )
}
