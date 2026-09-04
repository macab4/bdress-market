import Image from 'next/image'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Listing } from '@/types'
import { conditionLabel } from '@/lib/catalog'
import AdminNav from '@/components/admin/AdminNav'
import AdminListingActions from '@/components/admin/AdminListingActions'
import AdminReclassifyListing from '@/components/admin/AdminReclassifyListing'

type AdminListing = Listing & { seller: { name: string } | null }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-[#7fab87]/10 text-[#5a7a55]' },
  sold: { label: 'Vendida', color: 'bg-blue-50 text-blue-600' },
  paused: { label: 'Pausada', color: 'bg-gray-100 text-gray-400' },
}

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requireAdminUser()
  const { status, q } = await searchParams
  const admin = createAdminClient()

  const { data: listings } = await admin
    .from('listings')
    .select('*, seller:profiles(name)')
    .order('created_at', { ascending: false })
    .limit(1000) as unknown as { data: AdminListing[] | null }

  const everyListing = listings ?? []
  const byStatus = status === 'pending_review'
    ? everyListing.filter(l => l.pending_review)
    : status ? everyListing.filter(l => l.status === status) : everyListing
  const needle = q?.trim().toLowerCase()
  const all = needle
    ? byStatus.filter(l => l.title.toLowerCase().includes(needle) || (l.seller?.name ?? '').toLowerCase().includes(needle))
    : byStatus
  const pendingCount = everyListing.filter(l => l.pending_review).length

  const TABS: { value: string | undefined; label: string }[] = [
    { value: undefined, label: 'Todas' },
    { value: 'active', label: 'Activas' },
    { value: 'sold', label: 'Vendidas' },
    { value: 'paused', label: 'Pausadas' },
    { value: 'pending_review', label: 'Pendientes de revisión' },
  ]

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/listings" />
        </div>

        <div className="flex gap-6 mb-6">
          {TABS.map(tab => {
            const inTab = tab.value === 'pending_review'
              ? everyListing.filter(l => l.pending_review)
              : tab.value ? everyListing.filter(l => l.status === tab.value) : everyListing
            const count = needle
              ? inTab.filter(l => l.title.toLowerCase().includes(needle) || (l.seller?.name ?? '').toLowerCase().includes(needle)).length
              : inTab.length
            const href = tab.value
              ? `/admin/listings?status=${tab.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`
              : q ? `/admin/listings?q=${encodeURIComponent(q)}` : '/admin/listings'
            return (
              <Link
                key={tab.label}
                href={href}
                className={`text-[10px] tracking-widest uppercase pb-1 ${status === tab.value ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
              >
                {tab.label} ({count})
              </Link>
            )
          })}
        </div>

        <form action="/admin/listings" method="get" className="mb-4">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Buscar por nombre de prenda o vendedora…"
            className="w-full max-w-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
        </form>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          {status === 'pending_review'
            ? 'Pendientes de revisión'
            : status ? `Prendas ${STATUS_LABEL[status]?.label.toLowerCase() ?? status}` : 'Todas las prendas'} ({all.length})
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
                  <Link
                    href={`/admin/listings/${listing.id}/photos`}
                    className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black flex-shrink-0"
                  >
                    Editar fotos
                  </Link>
                  {listing.pending_review && (
                    <AdminReclassifyListing
                      listingId={listing.id}
                      department={listing.category}
                      productCategory={listing.product_category}
                      productType={listing.product_type}
                    />
                  )}
                  <AdminListingActions listingId={listing.id} status={listing.status} sellerDeprioritized={listing.seller_deprioritized} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
