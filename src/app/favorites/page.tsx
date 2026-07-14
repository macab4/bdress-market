import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import { conditionGroupLabel } from '@/lib/catalog'
import FavoriteButton from '@/components/listings/FavoriteButton'

export default async function FavoritesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: favorites } = await supabase
    .from('favorites')
    .select('id, listing:listings(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as {
      data: { id: string; listing: Listing | null }[] | null
    }

  const listings = (favorites ?? []).map(f => f.listing).filter((l): l is Listing => l !== null)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Favoritos</h1>

        {listings.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {listings.map(listing => (
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
                  {listing.status !== 'active' && (
                    <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] tracking-widest uppercase">
                      {listing.status === 'sold' ? 'Vendida' : 'Pausada'}
                    </span>
                  )}
                  <span className="absolute top-2 left-2 bg-white text-[9px] tracking-widest uppercase px-2 py-1">
                    {conditionGroupLabel(listing.condition)}
                  </span>
                  <div className="absolute bottom-2 right-2">
                    <FavoriteButton
                      listingId={listing.id}
                      initialFavorited={true}
                      isLoggedIn={true}
                    />
                  </div>
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
          <div className="text-center py-20 bg-white">
            <p className="text-gray-400 text-sm mb-2">Todavía no tienes prendas favoritas.</p>
            <Link href="/" className="text-[#8DA988] text-xs underline">Explorar prendas</Link>
          </div>
        )}
      </div>
    </div>
  )
}
