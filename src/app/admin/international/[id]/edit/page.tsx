import { notFound } from 'next/navigation'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Listing, ListingSourcing } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import InternationalListingForm from '@/components/admin/InternationalListingForm'

export default async function EditInternationalListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('source_type', 'international_on_demand')
    .single() as unknown as { data: Listing | null }

  if (!listing) notFound()

  const { data: sourcing } = await admin
    .from('listing_sourcing')
    .select('*')
    .eq('listing_id', id)
    .maybeSingle() as unknown as { data: ListingSourcing | null }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/international" />
        </div>
        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">Editar producto internacional</h2>
        <InternationalListingForm listing={listing} sourcing={sourcing ?? undefined} />
      </div>
    </div>
  )
}
