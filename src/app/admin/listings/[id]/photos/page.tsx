import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminPhotoEditor from '@/components/admin/AdminPhotoEditor'

export default async function AdminListingPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const admin = createAdminClient()

  const { data: listing } = await admin.from('listings').select('id, title, photos, seller:profiles(name)').eq('id', id).single() as unknown as {
    data: { id: string; title: string; photos: string[]; seller: { name: string } | null } | null
  }

  if (!listing) notFound()

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-2">Panel de administración</h1>
        <Link href="/admin/listings" className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black">
          ← Volver a Prendas
        </Link>

        <div className="bg-white p-6 mt-6">
          <p className="text-sm font-medium mb-0.5">{listing.title}</p>
          <p className="text-xs text-gray-400 mb-6">Vendedora: {listing.seller?.name ?? '—'}</p>

          <AdminPhotoEditor listingId={listing.id} initialPhotos={listing.photos} />
        </div>
      </div>
    </div>
  )
}
