import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import PauseListingButton from '@/components/dashboard/PauseListingButton'
import DeleteListingButton from '@/components/dashboard/DeleteListingButton'
import RenewListingButton from '@/components/dashboard/RenewListingButton'
import FeatureListingButton from '@/components/dashboard/FeatureListingButton'

export default async function ListingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: listingsData } = await supabase
    .from('listings')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const listings = (listingsData ?? []) as Listing[]
  const activeListings = listings.filter(l => l.status === 'active' || l.status === 'paused')

  type RepopOrder = { id: string; amount: number; listing: { title: string; brand: string; photos: string[] } | null }
  let repopOrders: RepopOrder[] = []
  if (activeListings.length === 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, amount, listing:listings(title, brand, photos)')
      .eq('buyer_id', user.id)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false })
      .limit(4) as unknown as { data: RepopOrder[] | null }
    repopOrders = data ?? []
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-light tracking-widest uppercase">Mis prendas</h1>
          <Link href="/listings/new"
            className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#6f9678] transition">
            + Publicar
          </Link>
        </div>

        <section>
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Activas y pausadas ({activeListings.length})
          </h2>

          {activeListings.length === 0 ? (
            <div className="bg-white p-10 text-center">
              <p className="text-sm text-gray-400 mb-4">Aún no tienes prendas publicadas.</p>

              {repopOrders.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-xs font-medium mb-1">¿No sabes qué publicar?</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Revende algo que ya compraste — precargamos los datos por ti.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {repopOrders.map(order => {
                      const photo = order.listing?.photos?.[0]
                      return (
                        <div key={order.id} className="text-left">
                          <div className="aspect-square bg-gray-100 relative overflow-hidden mb-2">
                            {photo ? (
                              <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                            )}
                          </div>
                          <p className="text-xs font-medium truncate">{order.listing?.brand || order.listing?.title}</p>
                          <p className="text-[10px] text-gray-400 mb-2">
                            Comprado: ${order.amount.toLocaleString('es-CL')}
                          </p>
                          <Link
                            href={`/listings/new?fromOrder=${order.id}`}
                            className="block text-center bg-[#7fab87] text-white text-[9px] tracking-widest uppercase py-2 hover:bg-[#6f9678] transition"
                          >
                            Revender
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {activeListings.map(listing => {
                const photo = listing.photos?.[0]
                return (
                  <div key={listing.id} className="bg-white p-4 flex gap-4 items-center">
                    <div className="w-14 h-16 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                      {photo ? (
                        <Image src={photo} alt={listing.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{listing.title}</p>
                      <p className="text-xs text-gray-400">{listing.brand} · T. {listing.size}</p>
                      <p className="text-sm font-semibold mt-0.5">${listing.price.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${
                          listing.status === 'active' ? 'bg-[#7fab87]/10 text-[#5a7a55]' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {listing.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                        <Link href={`/listings/${listing.id}/edit`}
                          className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-3 py-1.5 hover:bg-[#6f9678] transition">
                          Editar
                        </Link>
                      </div>
                      <div className="flex items-center gap-3">
                        <PauseListingButton listingId={listing.id} currentStatus={listing.status as 'active' | 'paused'} />
                        {listing.status === 'active' && (
                          <RenewListingButton listingId={listing.id} bumpedAt={listing.bumped_at} />
                        )}
                        <Link href={`/listings/${listing.id}`}
                          className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black">
                          Ver
                        </Link>
                        <DeleteListingButton listingId={listing.id} listingTitle={listing.title} />
                      </div>
                      {listing.status === 'active' && (
                        <FeatureListingButton listingId={listing.id} featuredUntil={listing.featured_until} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
