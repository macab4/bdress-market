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

  return <ListingForm listing={listing} />
}
