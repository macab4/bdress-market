import Image from 'next/image'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Order } from '@/types'
import { ORDER_STATUS_CONFIG } from '@/lib/catalog'
import AdminNav from '@/components/admin/AdminNav'

type AdminShipment = Order & {
  listing: { title: string; photos: string[] } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

export default async function AdminShipmentsPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const { data: shipments } = await admin
    .from('orders')
    .select('*, listing:listings(title, photos), buyer:profiles!orders_buyer_id_fkey(name), seller:profiles!orders_seller_id_fkey(name)')
    .not('tracking_number', 'is', null)
    .order('shipped_at', { ascending: false }) as unknown as { data: AdminShipment[] | null }

  const all = shipments ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/shipments" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Etiquetas generadas ({all.length})
        </h2>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Todavía no se generó ninguna etiqueta de envío.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {all.map(order => {
              const photo = order.listing?.photos?.[0]
              const status = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
              return (
                <div key={order.id} className="bg-white p-5">
                  <div className="flex gap-4">
                    <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                      {photo ? (
                        <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">{order.listing?.title ?? 'Prenda eliminada'}</p>
                        <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Compradora: {order.buyer?.name ?? '—'} · Vendedora: {order.seller?.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Seguimiento: <span className="font-mono">{order.tracking_number}</span>
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        {order.label_url && (
                          <a
                            href={order.label_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline"
                          >
                            Ver etiqueta
                          </a>
                        )}
                        <Link
                          href={`/listings/${order.listing_id}`}
                          className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black"
                        >
                          Ver prenda
                        </Link>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-2">
                        {order.shipped_at
                          ? new Date(order.shipped_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
