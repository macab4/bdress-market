import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Listing } from '@/types'
import ListingForm from '@/components/listings/ListingForm'

export default async function EditListingPage({
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
  if (!user || user.id !== listing.seller_id) redirect(`/listings/${id}`)

  // El precio no se puede tocar mientras haya una oferta esperando respuesta —
  // cambiarlo a mitad de una negociación dejaría la oferta pactada sobre un
  // precio que ya no existe.
  const { data: activeOffer } = await supabase
    .from('offers')
    .select('id')
    .eq('listing_id', id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  return <ListingForm listing={listing} priceLocked={activeOffer !== null} />
}
