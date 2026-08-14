import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import PhotoGallery from '@/components/listings/PhotoGallery'
import BuyButton from '@/components/listings/BuyButton'
import FavoriteButton from '@/components/listings/FavoriteButton'
import ShareButton from '@/components/listings/ShareButton'
import { CONDITIONS, CATEGORIES, conditionGroupLabel, conditionGroupColor, colorLabel, colorHex, buyerProtectionFee, minOfferPrice, formatRelativeTime, productCategoryLabel, brandSlug } from '@/lib/catalog'
import { getShippingQuote } from '@/lib/starken'
import ProtectedPrice from '@/components/listings/ProtectedPrice'
import BuyerProtectionModal from '@/components/listings/BuyerProtectionModal'
import MakeOfferModal from '@/components/listings/MakeOfferModal'
import InternationalInfoModal from '@/components/listings/InternationalInfoModal'
import RatingBadge from '@/components/reviews/RatingBadge'
import { getSellerRatings } from '@/lib/reviews'
import { getFavoriteCounts } from '@/lib/favorites'
import PauseListingButton from '@/components/dashboard/PauseListingButton'
import DeleteListingButton from '@/components/dashboard/DeleteListingButton'
import MarkSoldButton from '@/components/dashboard/MarkSoldButton'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

// Estilo compartido para los atributos navegables de la ficha (marca,
// categoría, ocasión, color) — negro suave en vez de azul de link tradicional,
// con foco visible para navegación por teclado.
const BREADCRUMB_LINK = 'hover:text-black hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7fab87] focus-visible:rounded-sm'
const ATTR_LINK = 'text-gray-700 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7fab87] focus-visible:rounded-sm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('title, brand, price, photos')
    .eq('id', id)
    .single()

  if (!listing) return { title: 'Prenda no encontrada — Bdress Market' }

  const title = `${listing.title}${listing.brand ? ` — ${listing.brand}` : ''} | Bdress Market`
  const description = `$${listing.price.toLocaleString('es-CL')} · Compra y vende ropa de segunda mano en Bdress Market`
  const image = listing.photos?.[0]
  const url = `${SITE_URL}/listings/${id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: image ? [{ url: image, width: 800, height: 1000 }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

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

  const [{ data: listing }, { data: { user } }, favoriteCounts] = await Promise.all([
    supabase
      .from('listings')
      .select('*, seller:profiles(id, name, city, avatar_url, bio, comuna), brand_ref:brands(id, display_name, slug)')
      .eq('id', id)
      .single() as unknown as Promise<{ data: ListingWithSeller | null }>,
    supabase.auth.getUser(),
    getFavoriteCounts([id]),
  ])
  const favoriteCount = favoriteCounts[id] ?? 0

  if (!listing) notFound()

  // Gradual: si el listing ya tiene brand_id, usa la marca canónica
  // (brands.slug/display_name). Si todavía no fue migrado, cae al viejo
  // agrupamiento por texto (brandSlug) — ver src/lib/brands.ts.
  const brandRef = listing.brand_ref
  const brandLabel = brandRef?.display_name ?? listing.brand
  const brandHref = brandRef ? `/?brand=${brandRef.slug}` : `/?brand=${brandSlug(listing.brand)}`

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

  // Condición central de ownership — de acá cuelga toda la diferencia entre
  // la vista de compradora y la vista de gestión de la dueña de la
  // publicación (incluye el perfil "Bdress Internacional": si alguna vez se
  // inicia sesión como esa cuenta, ve exactamente la misma vista de dueña,
  // sin lógica aparte).
  const isOwner = user !== null && user.id === listing.seller_id

  const canBuy =
    listing.status === 'active' &&
    user !== null &&
    !isOwner

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
  const pcLabel = listing.product_category ? productCategoryLabel(listing.category, listing.product_category) : null
  const typeLabel = listing.product_type || listing.subcategory || null

  // Resumen compacto de atributos para mostrar junto al precio, sin repetir
  // la tabla completa de specs (que se mantiene más abajo en la ficha).
  const essentialAttrs = [
    listing.size ? `Talla ${listing.size}` : null,
    conditionDetail.label,
    listing.colors && listing.colors.length > 0 ? listing.colors.map(colorLabel).join(', ') : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/" className={BREADCRUMB_LINK}>Inicio</Link>
          {categoryLabel && (
            <>
              {' · '}
              <Link href={`/?category=${listing.category}`} className={BREADCRUMB_LINK}>{categoryLabel}</Link>
            </>
          )}
          {pcLabel && (
            <>
              {' · '}
              <Link href={`/?category=${listing.category}&productCategory=${listing.product_category}`} className={BREADCRUMB_LINK}>{pcLabel}</Link>
            </>
          )}
          {typeLabel && (
            listing.product_type ? (
              <>
                {' · '}
                <Link
                  href={`/?category=${listing.category}&productCategory=${listing.product_category}&productType=${encodeURIComponent(listing.product_type)}`}
                  className={BREADCRUMB_LINK}
                >
                  {typeLabel}
                </Link>
              </>
            ) : ` · ${typeLabel}`
          )}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Galería */}
          <div>
            <PhotoGallery photos={listing.photos} title={listing.title} />
          </div>

          {/* Detalle */}
          <div>
            {/* Bloque principal de compra — se mantiene sticky en desktop
                mientras la usuaria revisa las fotos, así las acciones
                principales quedan siempre a mano. Deliberadamente corto: solo
                lo esencial para decidir y actuar (nombre, precio, datos
                clave, envío resumido y los 3 CTA) — todo lo demás vive más
                abajo, fuera del bloque sticky. */}
            <div className="space-y-5 md:sticky md:top-6 md:bg-[#EBEBEB] md:z-10 md:pb-4">
              {listing.status === 'sold' && (
                <div className="bg-gray-900 text-white text-center text-xs tracking-widest uppercase py-2">
                  Prenda vendida
                </div>
              )}

              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {brandLabel ? (
                      <Link
                        href={brandHref}
                        className="text-[10px] tracking-widest uppercase text-[#7fab87] underline underline-offset-2 hover:text-[#5a7a55] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7fab87] focus-visible:rounded-sm"
                      >
                        {brandLabel}
                      </Link>
                    ) : (
                      <p className="text-[10px] tracking-widest uppercase text-gray-400">Sin marca</p>
                    )}
                    <h1 className="font-serif text-xl tracking-wide mt-0.5">{listing.title}</h1>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-1 whitespace-nowrap ${conditionGroupColor(listing.condition)}`}>
                      {conditionGroupLabel(listing.condition)}
                    </span>
                    <ShareButton listingId={listing.id} title={listing.title} buttonClassName="border border-gray-200" />
                    <FavoriteButton
                      listingId={listing.id}
                      initialFavorited={isFavorited}
                      initialCount={favoriteCount}
                      isLoggedIn={user !== null}
                      buttonClassName="border border-gray-200"
                    />
                  </div>
                </div>

                {essentialAttrs && (
                  <p className="text-sm text-gray-500 mt-1.5">{essentialAttrs}</p>
                )}

                <div className="mt-2">
                  <ProtectedPrice price={listing.price} size="lg" />
                </div>
              </div>

              {/* Envío internacional — resumen compacto solamente; la
                  explicación completa vive en el modal que este mismo
                  componente ya abre ("¿Cómo funciona?"), sin bloque extra
                  aquí arriba que empuje el CTA hacia abajo. */}
              {listing.source_type === 'international_on_demand' && (
                <InternationalInfoModal
                  leadTimeMinDays={listing.international_lead_time_min_days}
                  leadTimeMaxDays={listing.international_lead_time_max_days}
                />
              )}

              {/* Acciones principales — se bifurca en el primer nivel según
                  ownership, no según status, para que la dueña vea su panel
                  de gestión también con la prenda pausada o vendida (antes
                  esto solo pasaba con la prenda activa). */}
              {isOwner ? (
                <div className="space-y-3">
                  <p className="text-[10px] tracking-widest uppercase text-gray-400">Tu publicación</p>

                  {listing.status === 'sold' ? (
                    <p className="text-xs text-gray-400 text-center py-4 border border-gray-200">
                      Esta prenda ya fue vendida.
                    </p>
                  ) : (
                    <>
                      <Link href={`/listings/${listing.id}/edit`}
                        className="block w-full text-center text-xs tracking-widest uppercase text-white bg-[#7fab87] hover:bg-[#6f9678] py-4 transition">
                        Editar publicación
                      </Link>
                      <MarkSoldButton listingId={listing.id} listingTitle={listing.title} />
                      <PauseListingButton listingId={listing.id} currentStatus={listing.status as 'active' | 'paused'} variant="block" />
                    </>
                  )}

                  <DeleteListingButton listingId={listing.id} listingTitle={listing.title} variant="block" />
                </div>
              ) : listing.status === 'active' && (
                canBuy ? (
                  <div className="space-y-3">
                    {offerAccepted && (
                      <p className="text-xs text-[#5a7a55] bg-[#7fab87]/10 text-center py-2">
                        ¡Tu oferta de ${myOffer!.offered_price.toLocaleString('es-CL')} fue aceptada! Cómprala antes de que venza.
                      </p>
                    )}
                    <BuyButton listingId={listing.id} total={buyPrice + buyerProtectionFee(buyPrice)} />

                    {/* Sin negociación de precio en productos internacionales — el
                        precio ya refleja un margen ajustado a un costo de compra que
                        todavía no se confirma, y no se puede prometer una rebaja
                        antes de comprar la prenda en origen. */}
                    {!myOffer && listing.source_type !== 'international_on_demand' && (
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
                ) : (
                  <div className="space-y-2">
                    <Link href="/auth/login"
                      className="block w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 text-center hover:bg-[#6f9678] transition">
                      Ingresar para comprar
                    </Link>
                    <p className="text-[10px] text-gray-400 text-center">
                      Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Resto de la información — debajo de las acciones principales,
                fuera del bloque sticky. */}
            <div className="space-y-6 mt-8">
              {/* Specs */}
              <div>
                <div className="bg-white divide-y divide-gray-100 text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-400">Marca</span>
                    {brandLabel ? (
                      <Link
                        href={brandHref}
                        className="text-[#7fab87] underline underline-offset-2 hover:text-[#5a7a55] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7fab87] focus-visible:rounded-sm"
                      >
                        {brandLabel}
                      </Link>
                    ) : (
                      <span className="text-gray-700">Sin marca</span>
                    )}
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
                          <Link key={color} href={`/?color=${color}`} className={`flex items-center gap-1.5 ${ATTR_LINK}`}>
                            <span
                              className="w-3 h-3 rounded-full border border-gray-300 inline-block"
                              style={{ backgroundColor: colorHex(color) }}
                            />
                            {colorLabel(color)}
                          </Link>
                        ))}
                      </span>
                    </div>
                  )}
                  {categoryLabel && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Categoría</span>
                      <span className="text-gray-700">
                        <Link href={`/?category=${listing.category}`} className={ATTR_LINK}>{categoryLabel}</Link>
                        {pcLabel && (
                          <>
                            {' · '}
                            <Link href={`/?category=${listing.category}&productCategory=${listing.product_category}`} className={ATTR_LINK}>{pcLabel}</Link>
                          </>
                        )}
                        {typeLabel && (
                          listing.product_type ? (
                            <>
                              {' · '}
                              <Link
                                href={`/?category=${listing.category}&productCategory=${listing.product_category}&productType=${encodeURIComponent(listing.product_type)}`}
                                className={ATTR_LINK}
                              >
                                {typeLabel}
                              </Link>
                            </>
                          ) : ` · ${typeLabel}`
                        )}
                      </span>
                    </div>
                  )}
                  {listing.length && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Largo</span>
                      <span className="text-gray-700">{listing.length}</span>
                    </div>
                  )}
                  {listing.occasion && listing.occasion.length > 0 && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Ocasión</span>
                      <span className="text-gray-700 flex flex-wrap justify-end gap-x-1">
                        {listing.occasion.map((o, i) => (
                          <span key={o}>
                            <Link href={`/?occasion=${encodeURIComponent(o)}`} className={ATTR_LINK}>{o}</Link>
                            {i < listing.occasion!.length - 1 && ','}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  {listing.season && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Temporada</span>
                      <span className="text-gray-700">{listing.season}</span>
                    </div>
                  )}
                  {listing.style && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Estilo</span>
                      <span className="text-gray-700">{listing.style}</span>
                    </div>
                  )}
                  {listing.material && (
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-gray-400">Material</span>
                      <span className="text-gray-700">{listing.material}</span>
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

              {/* Desglose de precio — accordion, no cambia ningún cálculo */}
              <details className="bg-white text-xs text-gray-500 group">
                <summary className="px-4 py-3 text-[10px] tracking-widest uppercase text-gray-400 cursor-pointer list-none flex items-center justify-between">
                  Ver detalle del precio
                  <span className="transition group-open:rotate-180">↓</span>
                </summary>
                <div className="px-4 pb-4 space-y-1">
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
              </details>

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

              {/* Card vendedora — no tiene sentido mostrarle a la dueña su
                  propia card de "Vendedora" con un link a "Ver perfil" de
                  sí misma. */}
              {!isOwner && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
