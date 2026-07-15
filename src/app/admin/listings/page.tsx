import Image from 'next/image'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Listing } from '@/types'
import { conditionLabel } from '@/lib/catalog'
import AdminNav from '@/components/admin/AdminNav'
import AdminListingActions from '@/components/admin/AdminListingActions'

type AdminListing = Listing & { seller: { name: string } | null }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-[#7fab87]/10 text-[#5a7a55]' },
  sold: { label: 'Vendida', color: 'bg-blue-50 text-blue-600' },
  paused: { label: 'Pausada', color: 'bg-gray-100 text-gray-400' },
}

export default async function AdminListingsPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const { data: listings } = await admin
    .from('listings')
    .select('*, seller:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(200) as unknown as { data: AdminListing[] | null }

  const all = listings ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/listings" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Todas las prendas ({all.length})
        </h2>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">No hay prendas publicadas todavía.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {all.map(listing => {
              const photo = listing.photos?.[0]
              const status = STATUS_LABEL[listing.status] ?? { label: listing.status, color: 'bg-gray-100 text-gray-400' }
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
                    <p className="text-xs text-gray-400">{listing.seller?.name ?? '—'} · {conditionLabel(listing.condition)}</p>
                    <p className="text-sm font-semibold mt-0.5">${listing.price.toLocaleString('es-CL')}</p>
                  </div>
                  <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 flex-shrink-0 whitespace-nowrap ${status.color}`}>
                    {status.label}
                  </span>
                  <AdminListingActions listingId={listing.id} status={listing.status} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
