import Image from 'next/image'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Order } from '@/types'
import AdminNav from '@/components/admin/AdminNav'
import DisputeResolutionActions from '@/components/admin/DisputeResolutionActions'

type AdminDispute = Order & {
  listing: { title: string; photos: string[] } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

export default async function AdminDisputesPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const { data: disputes } = await admin
    .from('orders')
    .select('*, listing:listings(title, photos), buyer:profiles!orders_buyer_id_fkey(name), seller:profiles!orders_seller_id_fkey(name)')
    .eq('status', 'disputed')
    .order('created_at', { ascending: false }) as unknown as { data: AdminDispute[] | null }

  const all = disputes ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/disputes" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Disputas abiertas ({all.length})
        </h2>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">No hay disputas abiertas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {all.map(order => {
              const photo = order.listing?.photos?.[0]
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
                      <p className="text-sm font-medium">{order.listing?.title ?? 'Prenda eliminada'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Compradora: {order.buyer?.name ?? '—'} · Vendedora: {order.seller?.name ?? '—'}
                      </p>
                      <p className="text-sm font-semibold mt-1">${order.amount.toLocaleString('es-CL')}</p>

                      {order.dispute_reason && (
                        <div className="bg-red-50 p-3 mt-3 text-sm text-red-700">
                          {order.dispute_reason}
                        </div>
                      )}

                      <DisputeResolutionActions orderId={order.id} />
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
