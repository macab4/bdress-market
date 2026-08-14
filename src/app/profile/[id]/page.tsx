import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Truck, MessageCircle, Sparkles, BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Listing, Profile, Review } from '@/types'
import { conditionGroupLabel } from '@/lib/catalog'
import StarRating from '@/components/reviews/StarRating'
import FollowButton from '@/components/profile/FollowButton'
import ProfileListingsSort from '@/components/profile/ProfileListingsSort'
import FavoriteButton from '@/components/listings/FavoriteButton'
import { getFavoriteCounts } from '@/lib/favorites'
import { hasFastShippingBadge, hasFastReplyBadge, isActiveSeller } from '@/lib/profileStats'
import PauseListingButton from '@/components/dashboard/PauseListingButton'
import DeleteListingButton from '@/components/dashboard/DeleteListingButton'
import RenewListingButton from '@/components/dashboard/RenewListingButton'
import FeatureListingButton from '@/components/dashboard/FeatureListingButton'

type ReviewWithReviewer = Review & { reviewer: { name: string; avatar_url: string | null } | null }
type SortValue = 'recientes' | 'precio_asc' | 'precio_desc'

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; sort?: string }>
}) {
  const { id } = await params
  const { tab, sort } = await searchParams
  const activeTab = tab === 'reviews' ? 'reviews' : 'listings'
  const sortValue: SortValue = sort === 'precio_asc' || sort === 'precio_desc' ? sort : 'recientes'

  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: profile },
    { data: { user } },
    { data: reviews },
    { count: followerCount },
    { count: completedSalesCount },
    { data: shippingOrders },
    { data: messageRows },
    authUser,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single() as unknown as Promise<{ data: Profile | null }>,
    supabase.auth.getUser(),
    supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(name, avatar_url)')
      .eq('reviewed_id', id)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: ReviewWithReviewer[] | null }>,
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', id),
    // Ventas completadas: orders.status = 'completed' es el único estado
    // terminal exitoso (ver OrderStatus en types/index.ts) — no cuenta
    // ofertas, pendientes, canceladas ni disputadas.
    admin.from('orders').select('*', { count: 'exact', head: true }).eq('seller_id', id).eq('status', 'completed'),
    // Para el badge "Despacha rápido" — paid_at/shipped_at de sus órdenes.
    // orders tiene RLS solo para compradora/vendedora, así que un perfil
    // público necesita el cliente admin para leer esto de otra usuaria.
    admin.from('orders').select('paid_at, shipped_at').eq('seller_id', id).not('shipped_at', 'is', null),
    // Para el badge "Responde rápido" — solo remitente/destinatario/fecha,
    // nunca el contenido de los mensajes.
    admin.from('messages').select('sender_id, receiver_id, listing_id, created_at').or(`sender_id.eq.${id},receiver_id.eq.${id}`).limit(500),
    admin.auth.admin.getUserById(id),
  ])

  if (!profile) notFound()

  const isOwnProfile = user?.id === id

  let listingsQuery = supabase
    .from('listings')
    .select('*')
    .eq('seller_id', id)
  listingsQuery = isOwnProfile
    ? listingsQuery.in('status', ['active', 'paused'])
    : listingsQuery.eq('status', 'active')
  if (sortValue === 'precio_asc') listingsQuery = listingsQuery.order('price', { ascending: true })
  else if (sortValue === 'precio_desc') listingsQuery = listingsQuery.order('price', { ascending: false })
  else listingsQuery = listingsQuery.order('created_at', { ascending: false })
  const { data: listings } = await listingsQuery as unknown as { data: Listing[] | null }

  let favoritedIds = new Set<string>()
  if (user && listings && listings.length > 0) {
    const { data: favRows } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .in('listing_id', listings.map(l => l.id))
    favoritedIds = new Set((favRows ?? []).map(f => f.listing_id))
  }
  const favoriteCounts = listings ? await getFavoriteCounts(listings.map(l => l.id)) : {}

  let isFollowing = false
  if (user && !isOwnProfile) {
    const { data: followRow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('followed_id', id)
      .maybeSingle()
    isFollowing = !!followRow
  }
  const reviewList = reviews ?? []
  const avgRating = reviewList.length > 0
    ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
    : 0

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })

  // Recuento de prendas activas + fecha de la más reciente, para el badge
  // "Vendedora activa" — reutiliza la misma lista ya consultada arriba
  // cuando el orden es el default; si está ordenada por precio, se calcula
  // aparte para no depender del orden de la query principal.
  const activeListings = (listings ?? []).filter(l => l.status === 'active')
  const mostRecentListingCreatedAt = activeListings.length > 0
    ? activeListings.reduce((latest, l) => l.created_at > latest ? l.created_at : latest, activeListings[0].created_at)
    : null

  const badges = {
    fastShipping: hasFastShippingBadge(shippingOrders ?? []),
    fastReply: hasFastReplyBadge(messageRows ?? [], id),
    active: isActiveSeller(activeListings.length, mostRecentListingCreatedAt),
    emailVerified: !!authUser.data.user?.email_confirmed_at,
  }
  const hasAnyBadge = badges.fastShipping || badges.fastReply || badges.active || badges.emailVerified

  function tabHref(nextTab: 'listings' | 'reviews') {
    const usp = new URLSearchParams()
    if (nextTab === 'reviews') usp.set('tab', 'reviews')
    const qs = usp.toString()
    return qs ? `/profile/${id}?${qs}` : `/profile/${id}`
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className="hover:text-black">Inicio</Link>
          {' · '}
          <span>{profile.name}</span>
        </p>

        {/* Header del perfil */}
        <div className="bg-white p-6 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-medium text-gray-600 overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile.name?.[0]?.toUpperCase() ?? '?'
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium">{profile.name}</h1>

              {reviewList.length > 0 ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <StarRating rating={avgRating} />
                  <span className="text-xs text-gray-500">
                    {avgRating.toFixed(1)} · {reviewList.length} {reviewList.length === 1 ? 'valoración' : 'valoraciones'}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Sin valoraciones aún</p>
              )}

              <p className="text-xs text-gray-500 mt-1">
                {(completedSalesCount ?? 0) > 0
                  ? `${completedSalesCount} ${completedSalesCount === 1 ? 'venta completada' : 'ventas completadas'}`
                  : 'Sin ventas completadas todavía'}
              </p>

              {hasAnyBadge && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                  {badges.emailVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <BadgeCheck size={13} className="text-[#7fab87]" /> Correo verificado
                    </span>
                  )}
                  {badges.fastShipping && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <Truck size={13} className="text-[#7fab87]" /> Despacha rápido
                    </span>
                  )}
                  {badges.fastReply && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <MessageCircle size={13} className="text-[#7fab87]" /> Responde rápido
                    </span>
                  )}
                  {badges.active && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                      <Sparkles size={13} className="text-[#7fab87]" /> Vendedora activa
                    </span>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-2">
                En Bdress desde {memberSince}
                {(followerCount ?? 0) > 0 && (
                  <> · {followerCount} {followerCount === 1 ? 'seguidora' : 'seguidoras'}</>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
              {isOwnProfile ? (
                <Link href="/profile/edit"
                  className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black border border-gray-200 px-4 py-2 text-center">
                  Editar perfil
                </Link>
              ) : (
                <FollowButton followedId={id} initialFollowing={isFollowing} isLoggedIn={!!user} />
              )}
            </div>
          </div>
        </div>

        {/* Accesos de cuenta — en desktop ya viven en el menú superior */}
        {isOwnProfile && (
          <div className="md:hidden flex flex-wrap gap-4 mb-10 text-xs">
            <Link href="/dashboard/sales" className="text-gray-500 hover:text-black tracking-widest uppercase">
              Mis ventas
            </Link>
            <Link href="/dashboard/offers" className="text-gray-500 hover:text-black tracking-widest uppercase">
              Mis ofertas
            </Link>
            <Link href="/dashboard/saved-searches" className="text-gray-500 hover:text-black tracking-widest uppercase">
              Mis búsquedas
            </Link>
            <Link href="/dashboard/messages" className="text-gray-500 hover:text-black tracking-widest uppercase">
              Mensajes
            </Link>
            {user?.email === process.env.ADMIN_EMAIL && (
              <Link href="/admin" className="text-gray-500 hover:text-black tracking-widest uppercase">
                Admin
              </Link>
            )}
            <form action="/auth/signout" method="POST">
              <button className="text-gray-400 hover:text-black tracking-widest uppercase">
                Salir
              </button>
            </form>
          </div>
        )}

        {profile.bio && (
          <div className="mb-10">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Sobre {profile.name}</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-gray-200 mb-6 overflow-x-auto">
          <Link
            href={tabHref('listings')}
            className={`text-xs tracking-widest uppercase pb-3 whitespace-nowrap ${
              activeTab === 'listings' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'
            }`}
          >
            Prendas {listings && listings.length > 0 && `(${listings.length})`}
          </Link>
          <Link
            href={tabHref('reviews')}
            className={`text-xs tracking-widest uppercase pb-3 whitespace-nowrap ${
              activeTab === 'reviews' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'
            }`}
          >
            Valoraciones {reviewList.length > 0 && `(${reviewList.length})`}
          </Link>
        </div>

        {activeTab === 'listings' ? (
          <>
            {isOwnProfile && (
              <div className="flex justify-end mb-4">
                <Link href="/listings/new"
                  className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#6f9678] transition">
                  + Publicar
                </Link>
              </div>
            )}

            {listings && listings.length > 1 && (
              <div className="flex justify-end mb-4">
                <ProfileListingsSort current={sortValue} />
              </div>
            )}

            {listings && listings.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {listings.map((listing) => (
                  <div key={listing.id} className="group bg-white">
                    <Link href={`/listings/${listing.id}`}>
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
                        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                          <span className="bg-white text-[9px] tracking-widest uppercase px-2 py-1">
                            {conditionGroupLabel(listing.condition)}
                          </span>
                          {listing.status === 'paused' && (
                            <span className="bg-gray-700 text-white text-[9px] tracking-widest uppercase px-2 py-1">
                              Pausada
                            </span>
                          )}
                          {listing.featured_until && new Date(listing.featured_until) > new Date() && (
                            <span className="bg-[#7fab87] text-white text-[9px] tracking-widest uppercase px-2 py-1">
                              Destacada
                            </span>
                          )}
                        </div>
                        <div className="absolute bottom-2 right-2">
                          <FavoriteButton
                            listingId={listing.id}
                            initialFavorited={favoritedIds.has(listing.id)}
                            initialCount={favoriteCounts[listing.id] ?? 0}
                            isLoggedIn={user !== null}
                          />
                        </div>
                      </div>
                      <div className="p-3 pb-1">
                        <p className="text-[10px] tracking-widest text-gray-400 uppercase">{listing.brand || 'Sin marca'}</p>
                        <p className="text-sm font-medium truncate mt-0.5">{listing.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm font-semibold">${listing.price.toLocaleString('es-CL')}</p>
                          <p className="text-[10px] text-gray-400">{listing.size}</p>
                        </div>
                      </div>
                    </Link>

                    {isOwnProfile && (
                      <div className="px-3 pb-3 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Link href={`/listings/${listing.id}/edit`}
                            className="flex-1 text-center bg-[#7fab87] text-white text-[9px] tracking-widest uppercase py-1.5 hover:bg-[#6f9678] transition">
                            Editar
                          </Link>
                          <PauseListingButton listingId={listing.id} currentStatus={listing.status as 'active' | 'paused'} />
                        </div>
                        <div className="flex items-center justify-between">
                          {listing.status === 'active' && (
                            <RenewListingButton listingId={listing.id} bumpedAt={listing.bumped_at} />
                          )}
                          <DeleteListingButton listingId={listing.id} listingTitle={listing.title} />
                        </div>
                        {listing.status === 'active' && (
                          <FeatureListingButton listingId={listing.id} featuredUntil={listing.featured_until} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-white">
                <p className="text-gray-400 text-sm">
                  {isOwnProfile ? 'Aún no tienes prendas publicadas.' : `${profile.name} no tiene prendas publicadas por el momento.`}
                </p>
              </div>
            )}
          </>
        ) : (
          <div>
            {reviewList.length > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-2xl font-light">{avgRating.toFixed(1)}</span>
                  <div>
                    <StarRating rating={avgRating} size={16} />
                    <p className="text-xs text-gray-400 mt-0.5">
                      {reviewList.length} {reviewList.length === 1 ? 'valoración' : 'valoraciones'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {reviewList.map(review => (
                    <div key={review.id} className="bg-white p-4">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium">{review.reviewer?.name ?? 'Usuaria'}</p>
                        <StarRating rating={review.rating} size={12} />
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
                      )}
                      <p className="text-[10px] text-gray-300 mt-2">
                        {new Date(review.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 bg-white">
                <p className="text-gray-400 text-sm">Esta vendedora todavía no tiene valoraciones.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
