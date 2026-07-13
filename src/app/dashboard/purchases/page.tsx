import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Order } from '@/types'
import ConfirmDeliveryButton from '@/components/dashboard/ConfirmDeliveryButton'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment: { label: 'Pago pendiente',  color: 'bg-gray-100 text-gray-500' },
  paid:            { label: 'Pagado',           color: 'bg-blue-50 text-blue-600' },
  shipped:         { label: 'En camino',        color: 'bg-amber-50 text-amber-600' },
  delivered:       { label: 'Entregado',        color: 'bg-green-50 text-green-700' },
  completed:       { label: 'Completado',       color: 'bg-[#8DA988]/10 text-[#5a7a55]' },
  disputed:        { label: 'En disputa',       color: 'bg-red-50 text-red-600' },
  cancelled:       { label: 'Cancelado',        color: 'bg-gray-100 text-gray-400' },
}

type OrderWithRelations = Order & {
  listing: { title: string; photos: string[]; price: number } | null
  seller: { name: string; city: string | null } | null
}

export default async function PurchasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: orders } = await supabase
    .from('orders')
    .select('*, listing:listings(title, photos, price), seller:profiles!orders_seller_id_fkey(name, city)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false }) as { data: OrderWithRelations[] | null }

  const list = orders ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mis compras</h1>

        {list.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400 mb-4">Aún no has comprado ninguna prenda.</p>
            <Link href="/" className="bg-black text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-gray-800 transition">
              Explorar prendas
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((order) => {
              const status = STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
              const photo = order.listing?.photos?.[0]

              return (
                <div key={order.id} className="bg-white p-5">
                  <div className="flex gap-4">
                    {/* Foto */}
                    <div className="w-20 h-24 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                      {photo ? (
                        <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium truncate">{order.listing?.title ?? 'Prenda eliminada'}</p>
                        <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 mb-1">
                        Vendedora: {order.seller?.name ?? '—'}
                        {order.seller?.city ? ` · ${order.seller.city}` : ''}
                      </p>

                      <p className="text-sm font-semibold">${order.amount.toLocaleString('es-CL')}</p>

                      {order.tracking_number && (
                        <p className="text-xs text-gray-400 mt-1">
                          Seguimiento: <span className="font-mono">{order.tracking_number}</span>
                        </p>
                      )}

                      {order.status === 'shipped' && (
                        <div className="mt-3">
                          <ConfirmDeliveryButton orderId={order.id} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fecha */}
                  <p className="text-[10px] text-gray-300 mt-3 text-right">
                    {new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
