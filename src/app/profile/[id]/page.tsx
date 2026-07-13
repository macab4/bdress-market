import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing, Profile, Review } from '@/types'
import { conditionLabel } from '@/lib/catalog'
import StarRating from '@/components/reviews/StarRating'

type ReviewWithReviewer = Review & { reviewer: { name: string; avatar_url: string | null } | null }

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: listings }, { data: { user } }, { data: reviews }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single() as unknown as Promise<{ data: Profile | null }>,
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', id)
      .eq('status', 'active')
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: Listing[] | null }>,
    supabase.auth.getUser(),
    supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(name, avatar_url)')
      .eq('reviewed_id', id)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: ReviewWithReviewer[] | null }>,
  ])

  const isOwnProfile = user?.id === id
  const reviewList = reviews ?? []
  const avgRating = reviewList.length > 0
    ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
    : 0

  if (!profile) notFound()

  const memberSince = new Date(profile.created_at).toLocaleDateString('es-CL', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className="hover:text-black">Inicio</Link>
          {' · '}
          <span>{profile.name}</span>
        </p>

        {/* Card de perfil */}
        <div className="bg-white p-6 flex items-center gap-4 mb-10">
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
            {profile.city && <p className="text-xs text-gray-400">{profile.city}</p>}
            <p className="text-[10px] text-gray-400 mt-1">En Bdress desde {memberSince}</p>
            {reviewList.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <StarRating rating={avgRating} />
                <span className="text-xs text-gray-500">
                  {avgRating.toFixed(1)} ({reviewList.length} {reviewList.length === 1 ? 'reseña' : 'reseñas'})
                </span>
              </div>
            )}
          </div>
          {isOwnProfile && (
            <Link href="/profile/edit"
              className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black border border-gray-200 px-4 py-2 flex-shrink-0">
              Editar perfil
            </Link>
          )}
        </div>

        {profile.bio && (
          <div className="mb-10">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Sobre {profile.name}</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {/* Prendas activas */}
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Prendas publicadas {listings && listings.length > 0 && `(${listings.length})`}
        </p>

        {listings && listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {listings.map((listing) => (
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
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white">
            <p className="text-gray-400 text-sm">{profile.name} no tiene prendas publicadas por ahora.</p>
          </div>
        )}

        {/* Valoraciones */}
        <div className="mt-10">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Valoraciones {reviewList.length > 0 && `(${reviewList.length})`}
          </p>

          {reviewList.length > 0 ? (
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
          ) : (
            <div className="text-center py-10 bg-white">
              <p className="text-gray-400 text-sm">{profile.name} todavía no tiene valoraciones.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
