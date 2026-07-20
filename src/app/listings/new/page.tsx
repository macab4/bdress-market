import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ListingForm from '@/components/listings/ListingForm'
import { CategoryValue, ShippingSizeValue } from '@/lib/catalog'

type PrefillListing = {
  title: string
  category: CategoryValue
  subcategory: string
  size: string
  brand: string
  colors: string[]
  shipping_size: ShippingSizeValue
}

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ fromOrder?: string }>
}) {
  const { fromOrder } = await searchParams
  if (!fromOrder) return <ListingForm />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: order } = await supabase
    .from('orders')
    .select('id, amount, listing:listings(title, category, subcategory, size, brand, colors, shipping_size)')
    .eq('id', fromOrder)
    .eq('buyer_id', user.id)
    .in('status', ['delivered', 'completed'])
    .maybeSingle() as unknown as { data: { id: string; amount: number; listing: PrefillListing | null } | null }

  if (!order?.listing) return <ListingForm />

  return <ListingForm prefill={order.listing} originalPrice={order.amount} />
}
