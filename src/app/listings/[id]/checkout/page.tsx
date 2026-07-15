import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import CheckoutForm from '@/components/listings/CheckoutForm'

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: listing }, { data: { user } }] = await Promise.all([
    supabase.from('listings').select('*').eq('id', id).single() as unknown as Promise<{ data: Listing | null }>,
    supabase.auth.getUser(),
  ])

  if (!listing) notFound()
  if (!user) redirect('/auth/login')
  if (listing.status !== 'active') redirect(`/listings/${id}`)
  if (listing.seller_id === user.id) redirect(`/listings/${id}`)

  const [{ data: profile }, { data: acceptedOffer }] = await Promise.all([
    supabase.from('profiles').select('name, phone, address, comuna, city').eq('id', user.id).single(),
    supabase
      .from('offers')
      .select('offered_price, accepted_expires_at')
      .eq('listing_id', id)
      .eq('buyer_id', user.id)
      .eq('status', 'accepted')
      .gt('accepted_expires_at', new Date().toISOString())
      .maybeSingle(),
  ])

  const price = acceptedOffer?.offered_price ?? listing.price

  return (
    <div className="min-h-screen bg-[#EBEBEB] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8 text-center">
          Finalizar compra
        </h1>

        {/* Resumen de la prenda */}
        <div className="bg-white p-4 flex gap-4 items-center mb-6">
          <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
            {listing.photos[0] ? (
              <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{listing.title}</p>
            <p className="text-xs text-gray-400">Talla {listing.size}</p>
            {acceptedOffer ? (
              <p className="text-sm mt-0.5">
                <span className="line-through text-gray-300 mr-2">${listing.price.toLocaleString('es-CL')}</span>
                <span className="font-semibold text-[#5a7a55]">${price.toLocaleString('es-CL')}</span>
              </p>
            ) : (
              <p className="text-sm font-semibold mt-0.5">${price.toLocaleString('es-CL')}</p>
            )}
          </div>
        </div>

        {acceptedOffer && (
          <p className="text-xs text-[#5a7a55] bg-[#7fab87]/10 text-center py-2 mb-6">
            Precio pactado por tu oferta — válido por tiempo limitado
          </p>
        )}

        <CheckoutForm
          listingId={listing.id}
          price={price}
          initialValues={{
            shipping_name: profile?.name ?? '',
            shipping_phone: profile?.phone ?? '',
            shipping_address: profile?.address ?? '',
            shipping_comuna: profile?.comuna ?? '',
            shipping_city: profile?.city ?? '',
          }}
        />
      </div>
    </div>
  )
}
