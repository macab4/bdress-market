import Image from 'next/image'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Listing, ListingSourcing } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import InternationalAvailabilityCheck from '@/components/admin/InternationalAvailabilityCheck'
import InternationalStatusControl from '@/components/admin/InternationalStatusControl'

type Row = Listing & { sourcing: ListingSourcing | null }

const SOURCE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: 'bg-[#7fab87]/10 text-[#5a7a55]' },
  pending_verification: { label: 'Por comprobar', color: 'bg-amber-50 text-amber-600' },
  purchased: { label: 'Comprada', color: 'bg-blue-50 text-blue-600' },
  unavailable: { label: 'No disponible', color: 'bg-red-50 text-red-600' },
}

export default async function AdminInternationalPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const { data: listings } = await admin
    .from('listings')
    .select('*, sourcing:listing_sourcing(*)')
    .eq('source_type', 'international_on_demand')
    .order('created_at', { ascending: false })
    .limit(500) as unknown as { data: Row[] | null }

  const all = (listings ?? []).map(l => ({ ...l, sourcing: Array.isArray(l.sourcing) ? l.sourcing[0] ?? null : l.sourcing }))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/international" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400">Selección internacional ({all.length})</h2>
          <div className="flex gap-4">
            <Link href="/admin/international/orders" className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
              Órdenes internacionales
            </Link>
            <Link href="/admin/international/new" className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#6f9678] transition">
              Nuevo producto internacional
            </Link>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Todavía no hay productos internacionales publicados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {all.map(listing => {
              const photo = listing.photos?.[0]
              const sourceStatus = SOURCE_STATUS_LABEL[listing.sourcing?.source_status ?? 'pending_verification']
              return (
                <div key={listing.id} className="bg-white p-4 flex gap-4 items-center">
                  <div className="w-14 h-16 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                    {photo ? <Image src={photo} alt={listing.title} fill className="object-cover" /> : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{listing.title}</p>
                    <p className="text-xs text-gray-400">
                      {listing.sourcing?.source_platform ?? 'manual'} · {listing.status === 'sold' ? 'Vendida' : 'Publicada'}
                      {listing.sourcing?.source_last_verified_at && ` · Verificado ${new Date(listing.sourcing.source_last_verified_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`}
                    </p>
                    <p className="text-sm font-semibold mt-0.5">${listing.price.toLocaleString('es-CL')}</p>
                  </div>
                  <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 flex-shrink-0 whitespace-nowrap ${sourceStatus.color}`}>
                    {sourceStatus.label}
                  </span>
                  <InternationalAvailabilityCheck listingId={listing.id} />
                  <InternationalStatusControl listingId={listing.id} status={listing.status} />
                  <Link href={`/admin/international/${listing.id}/edit`} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black flex-shrink-0">
                    Editar
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
