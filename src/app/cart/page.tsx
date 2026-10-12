import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import RemoveFromCartButton from '@/components/cart/RemoveFromCartButton'
import CartCheckoutForm from '@/components/cart/CartCheckoutForm'

export default async function CartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/cart')

  const { data: cartRows } = await supabase
    .from('cart_items')
    .select('id, listing:listings(*, seller:profiles(id, name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as {
      data: { id: string; listing: (Listing & { seller: { id: string; name: string } | null }) | null }[] | null
    }

  const rows = (cartRows ?? []).filter((r): r is typeof r & { listing: NonNullable<typeof r.listing> } => r.listing !== null)

  const [{ data: profile }, { data: walletAccount }, { data: acceptedOffers }] = await Promise.all([
    supabase.from('profiles').select('name, phone, address, comuna, city').eq('id', user.id).single(),
    supabase.from('wallet_accounts').select('available_balance, promo_balance').eq('user_id', user.id).maybeSingle(),
    rows.length > 0
      ? supabase.from('offers').select('listing_id, offered_price, accepted_expires_at')
          .in('listing_id', rows.map(r => r.listing.id)).eq('buyer_id', user.id).eq('status', 'accepted')
          .gt('accepted_expires_at', new Date().toISOString())
      : Promise.resolve({ data: [] as { listing_id: string; offered_price: number }[] }),
  ])
  const acceptedPriceByListing = new Map((acceptedOffers ?? []).map(o => [o.listing_id, o.offered_price]))

  // Las internacionales por encargo no entran al carrito (se compran aparte
  // desde su ficha, ver AddToCartButton) — si igual quedó una vieja en el
  // carrito de antes de este cambio, se avisa en vez de romper el checkout.
  const buyable = rows.filter(r => r.listing.status === 'active' && r.listing.source_type !== 'international_on_demand')
  const unavailable = rows.filter(r => r.listing.status !== 'active')
  const internationalInCart = rows.filter(r => r.listing.status === 'active' && r.listing.source_type === 'international_on_demand')

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mi carrito</h1>

        {rows.length === 0 ? (
          <div className="text-center py-20 bg-white">
            <p className="text-gray-400 text-sm mb-2">Tu carrito está vacío.</p>
            <Link href="/" className="text-[#7fab87] text-xs underline">Explorar prendas</Link>
          </div>
        ) : (
          <>
            <div className="bg-white mb-6">
              {buyable.map(row => {
                const listing = row.listing
                const price = acceptedPriceByListing.get(listing.id) ?? listing.price
                return (
                  <Link key={row.id} href={`/listings/${listing.id}`} className="flex gap-4 items-center p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                    <div className="w-14 h-18 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                      {listing.photos[0] ? (
                        <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{listing.title}</p>
                      <p className="text-[10px] text-gray-400">Vendedora: {listing.seller?.name ?? '—'}</p>
                      <p className="text-sm font-semibold mt-0.5">${price.toLocaleString('es-CL')}</p>
                    </div>
                    <div onClick={e => e.preventDefault()}>
                      <RemoveFromCartButton listingId={listing.id} />
                    </div>
                  </Link>
                )
              })}
            </div>

            {unavailable.length > 0 && (
              <div className="bg-amber-50 text-amber-700 text-xs p-3 mb-6">
                {unavailable.length === 1 ? 'Una prenda de tu carrito ya no está disponible' : `${unavailable.length} prendas de tu carrito ya no están disponibles`} — sácala del carrito para poder pagar.
                <div className="mt-2 space-y-1">
                  {unavailable.map(r => (
                    <div key={r.id} className="flex items-center justify-between">
                      <span className="truncate">{r.listing.title}</span>
                      <RemoveFromCartButton listingId={r.listing.id} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {internationalInCart.length > 0 && (
              <div className="bg-gray-50 text-gray-500 text-xs p-3 mb-6">
                {internationalInCart.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="truncate">{r.listing.title} es un envío internacional por encargo — se compra aparte</span>
                    <Link href={`/listings/${r.listing.id}`} className="text-[#5a7a55] underline underline-offset-2 flex-shrink-0 ml-2">Ver</Link>
                  </div>
                ))}
              </div>
            )}

            {buyable.length > 0 ? (
              <CartCheckoutForm
                items={buyable.map(r => ({
                  listingId: r.listing.id,
                  title: r.listing.title,
                  price: acceptedPriceByListing.get(r.listing.id) ?? r.listing.price,
                  sellerName: r.listing.seller?.name ?? '—',
                }))}
                walletAvailableBalance={walletAccount?.available_balance ?? 0}
                promoBalance={walletAccount?.promo_balance ?? 0}
                initialValues={{
                  shipping_name: profile?.name ?? '',
                  shipping_phone: profile?.phone ?? '',
                  shipping_address: profile?.address ?? '',
                  shipping_comuna: profile?.comuna ?? '',
                  shipping_city: profile?.city ?? '',
                }}
              />
            ) : (
              <p className="text-center text-sm text-gray-400 py-10 bg-white">Sácale las prendas no disponibles al carrito para poder pagar.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
