import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import PhotoGallery from '@/components/listings/PhotoGallery'
import BuyButton from '@/components/listings/BuyButton'
import FavoriteButton from '@/components/listings/FavoriteButton'
import ShareButton from '@/components/listings/ShareButton'
import { CONDITIONS, CATEGORIES, conditionGroupLabel, conditionGroupColor, colorLabel, colorHex, buyerProtectionFee, minOfferPrice, formatRelativeTime } from '@/lib/catalog'
import { getShippingQuote } from '@/lib/chilexpress'
import ProtectedPrice from '@/components/listings/ProtectedPrice'
import BuyerProtectionModal from '@/components/listings/BuyerProtectionModal'
import MakeOfferModal from '@/components/listings/MakeOfferModal'
import RatingBadge from '@/components/reviews/RatingBadge'
import { getSellerRatings } from '@/lib/reviews'

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  type ListingWithSeller = Listing & {
    seller: { id: string; name: string; city: string | null; avatar_url: string | null; bio: string | null; comuna: string | null }
  }

  const [{ data: listing }, { data: { user } }, { count: favoriteCount }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, seller:profiles(id, name, city, avatar_url, bio, comuna)')
      .eq('id', id)
      .single() as unknown as Promise<{ data: ListingWithSeller | null }>,
    supabase.auth.getUser(),
    supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('listing_id', id),
  ])

  if (!listing) notFound()

  const sellerRatings = await getSellerRatings(supabase, [listing.seller_id])
  const sellerRating = sellerRatings[listing.seller_id]

  let isFavorited = false
  if (user) {
    const { data: favorite } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle()
    isFavorited = favorite !== null
  }

  const commission = buyerProtectionFee(listing.price)
  const totalPrice = listing.price + commission

  // Estimado de envío para mostrar en la ficha — misma comuna como origen y
  // destino (referencia razonable). El costo real se recotiza en el checkout
  // según la dirección de la compradora.
  const shippingEstimate = listing.seller?.comuna
    ? await getShippingQuote({
        originComuna: listing.seller.comuna,
        destComuna: listing.seller.comuna,
        size: listing.shipping_size,
        declaredValue: listing.price,
      })
    : null

  const canBuy =
    listing.status === 'active' &&
    user !== null &&
    user.id !== listing.seller_id

  let myOffer: { offered_price: number; status: string; proposed_by: string; accepted_expires_at: string | null } | null = null
  if (canBuy) {
    const { data } = await supabase
      .from('offers')
      .select('offered_price, status, proposed_by, accepted_expires_at')
      .eq('listing_id', id)
      .eq('buyer_id', user!.id)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    myOffer = data && (data.status === 'pending' || (data.status === 'accepted' && data.accepted_expires_at && new Date(data.accepted_expires_at) > new Date()))
      ? data
      : null
  }
  const offerAccepted = myOffer?.status === 'accepted'
  const buyPrice = offerAccepted ? myOffer!.offered_price : listing.price

  const conditionDetail = CONDITIONS.find(c => c.value === listing.condition) ?? { label: listing.condition, description: '' }
  const categoryLabel = CATEGORIES.find(c => c.value === listing.category)?.label

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className="hover:text-black">Inicio</Link>
          {categoryLabel && (
            <>
              {' · '}
              <Link href={`/?category=${listing.category}`} className="hover:text-black">{categoryLabel}</Link>
            </>
          )}
          {listing.subcategory && ` · ${listing.subcategory}`}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Galería */}
          <div>
            <PhotoGallery photos={listing.photos} title={listing.title} />
          </div>

          {/* Detalle */}
          <div className="space-y-6">
            {listing.status === 'sold' && (
              <div className="bg-gray-900 text-white text-center text-xs tracking-widest uppercase py-2">
                Prenda vendida
              </div>
            )}

            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-gray-400">{listing.brand || 'Sin marca'}</p>
                  <h1 className="text-xl font-light tracking-wide mt-0.5">{listing.title}</h1>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[9px] tracking-widest uppercase px-2 py-1 whitespace-nowrap ${conditionGroupColor(listing.condition)}`}>
                    {conditionGroupLabel(listing.condition)}
                  </span>
                  <ShareButton title={listing.title} buttonClassName="border border-gray-200" />
                  <div className="flex items-center gap-1">
                    <FavoriteButton
                      listingId={listing.id}
                      initialFavorited={isFavorited}
                      isLoggedIn={user !== null}
                      buttonClassName="border border-gray-200"
                    />
                    {!!favoriteCount && favoriteCount > 0 && (
                      <span className="text-xs text-gray-400">{favoriteCount}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <ProtectedPrice price={listing.price} size="lg" />
              </div>
            </div>

            {/* Specs */}
            <div>
              <div className="bg-white divide-y divide-gray-100 text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-gray-400">Marca</span>
                  <span className="text-gray-700">{listing.brand || 'Sin marca'}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-gray-400">Talla</span>
                  <span className="text-gray-700">{listing.size}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-gray-400">Estado</span>
                  <span className="text-gray-700">{conditionDetail.label}</span>
                </div>
                {listing.colors && listing.colors.length > 0 && (
                  <div className="flex justify-between px-4 py-2.5 items-center">
                    <span className="text-gray-400">Color</span>
                    <span className="text-gray-700 flex items-center gap-3">
                      {listing.colors.map(color => (
                        <span key={color} className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-300 inline-block"
                            style={{ backgroundColor: colorHex(color) }}
                          />
                          {colorLabel(color)}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
                {categoryLabel && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-400">Categoría</span>
                    <span className="text-gray-700">{categoryLabel}{listing.subcategory && ` · ${listing.subcategory}`}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-gray-400">Publicado</span>
                  <span className="text-gray-700">{formatRelativeTime(listing.created_at)}</span>
                </div>
              </div>
              {conditionDetail.description && (
                <p className="text-xs text-gray-400 mt-2 px-1">{conditionDetail.description}</p>
              )}
            </div>

            {/* Descripción */}
            {listing.description && (
              <div>
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Descripción</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{listing.description}</p>
              </div>
            )}

            {/* Desglose de precio */}
            <div className="bg-white p-4 text-xs text-gray-500 space-y-1">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Detalle del precio</p>
              <div className="flex justify-between">
                <span>Precio de la prenda</span>
                <span>${listing.price.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <BuyerProtectionModal
                  trigger={<span className="underline decoration-dotted underline-offset-2 cursor-pointer hover:text-gray-600">Protección Comprador</span>}
                  triggerClassName="inline-flex"
                />
                <span>+ ${commission.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between font-medium text-[#5a7a55] border-t border-gray-100 pt-1 mt-1">
                <span>Total (sin envío)</span>
                <span>${totalPrice.toLocaleString('es-CL')}</span>
              </div>
              <p className="text-[10px] text-gray-400 pt-1">
                {shippingEstimate
                  ? `Envío desde $${shippingEstimate.price.toLocaleString('es-CL')} — se confirma en el siguiente paso según tu comuna. `
                  : 'El envío se calcula en el siguiente paso, según tu dirección. '}
                Publicar y vender en Bdress Market es gratis para la vendedora.
              </p>
            </div>

            {/* Botón comprar */}
            {listing.status === 'active' && (
              canBuy ? (
                <div className="space-y-3">
                  {offerAccepted && (
                    <p className="text-xs text-[#5a7a55] bg-[#7fab87]/10 text-center py-2">
                      ¡Tu oferta de ${myOffer!.offered_price.toLocaleString('es-CL')} fue aceptada! Cómprala antes de que venza.
                    </p>
                  )}
                  <BuyButton listingId={listing.id} total={buyPrice + buyerProtectionFee(buyPrice)} />

                  {!myOffer && (
                    <MakeOfferModal listingId={listing.id} sellerId={listing.seller_id} price={listing.price} minPrice={minOfferPrice(listing.price)} />
                  )}
                  <Link
                    href={`/dashboard/messages/${listing.id}/${listing.seller_id}`}
                    className="block w-full text-center border border-gray-300 text-gray-700 text-xs tracking-widest uppercase py-4 hover:border-[#7fab87] hover:text-[#7fab87] transition"
                  >
                    Enviar mensaje
                  </Link>
                  {myOffer?.status === 'pending' && myOffer.proposed_by === 'buyer' && (
                    <p className="text-xs text-gray-400 text-center">
                      Ofertaste ${myOffer.offered_price.toLocaleString('es-CL')} — esperando respuesta de la vendedora.{' '}
                      <Link href={`/dashboard/messages/${listing.id}/${listing.seller_id}`} className="text-[#5a7a55] underline underline-offset-2">Ver oferta</Link>
                    </p>
                  )}
                  {myOffer?.status === 'pending' && myOffer.proposed_by === 'seller' && (
                    <p className="text-xs text-gray-400 text-center">
                      La vendedora te ofreció ${myOffer.offered_price.toLocaleString('es-CL')}.{' '}
                      <Link href={`/dashboard/messages/${listing.id}/${listing.seller_id}`} className="text-[#5a7a55] underline underline-offset-2">Responder</Link>
                    </p>
                  )}
                </div>
              ) : user === null ? (
                <div className="space-y-2">
                  <Link href="/auth/login"
                    className="block w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 text-center hover:bg-[#6f9678] transition">
                    Ingresar para comprar
                  </Link>
                  <p className="text-[10px] text-gray-400 text-center">
                    Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 text-center py-4 border border-gray-200">
                    Esta es tu prenda publicada
                  </p>
                  <Link href={`/listings/${listing.id}/edit`}
                    className="block w-full text-center text-xs tracking-widest uppercase text-white bg-[#7fab87] hover:bg-[#6f9678] py-3 transition">
                    Editar prenda
                  </Link>
                </div>
              )
            )}

            {/* Confianza */}
            <div className="bg-white p-4 flex gap-3 items-start">
              <ShieldCheck size={20} className="text-[#5a7a55] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="text-sm text-black font-medium block mb-0.5">Compra y vende con seguridad</span>
                Tu pago queda retenido hasta que confirmes que todo llegó bien.{' '}
                <BuyerProtectionModal
                  trigger={<span className="underline decoration-dotted underline-offset-2 cursor-pointer hover:text-black">Cómo funciona</span>}
                  triggerClassName="inline-flex"
                />
              </p>
            </div>

            {/* Card vendedora */}
            <div className="border-t border-gray-200 pt-6">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-3">Vendedora</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 overflow-hidden flex-shrink-0">
                  {listing.seller?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.seller.avatar_url} alt={listing.seller.name} className="w-full h-full object-cover" />
                  ) : (
                    listing.seller?.name?.[0]?.toUpperCase() ?? '?'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{listing.seller?.name}</p>
                  <div className="flex items-center gap-1.5">
                    {listing.seller?.city && (
                      <p className="text-xs text-gray-400">{listing.seller.city}</p>
                    )}
                    {sellerRating && <RatingBadge rating={sellerRating.avg} count={sellerRating.count} />}
                  </div>
                </div>
                <Link href={`/profile/${listing.seller_id}`}
                  className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
                  Ver perfil
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
