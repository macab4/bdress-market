import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Order } from '@/types'
import GenerateLabelButton from '@/components/dashboard/GenerateLabelButton'
import AddTrackingForm from '@/components/dashboard/AddTrackingForm'
import ReviewForm from '@/components/reviews/ReviewForm'
import { daysUntilRelease } from '@/lib/catalog'

type OrderWithRelations = Order & {
  listing: { title: string; photos: string[] } | null
  buyer: { name: string } | null
}

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: ordersData } = await supabase
    .from('orders')
    .select('*, listing:listings(title, photos), buyer:profiles!orders_buyer_id_fkey(name)')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const orders = (ordersData ?? []) as OrderWithRelations[]

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('order_id')
    .eq('reviewer_id', user.id)
  const reviewedOrderIds = new Set((myReviews ?? []).map(r => r.order_id))

  const pendingOrders = orders.filter(o => o.status === 'paid')
  const shippedOrders = orders.filter(o => o.status === 'shipped')
  const deliveredOrders = orders.filter(o => o.status === 'delivered')
  const completedOrders = orders.filter(o => o.status === 'completed')

  const totalEarned = completedOrders.reduce((sum, o) => sum + (o.amount - o.commission - o.processing_fee), 0)
  const pendingAmount = orders
    .filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered')
    .reduce((sum, o) => sum + (o.amount - o.commission - o.processing_fee), 0)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <h1 className="text-xl font-light tracking-widest uppercase">Mis ventas</h1>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Vendas completadas', value: completedOrders.length },
            { label: 'Ganado (neto)', value: `$${totalEarned.toLocaleString('es-CL')}` },
            { label: 'Pendiente de cobro', value: `$${pendingAmount.toLocaleString('es-CL')}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">{label}</p>
              <p className="text-xl font-light">{value}</p>
            </div>
          ))}
        </div>

        {/* Órdenes a enviar */}
        {pendingOrders.length > 0 && (
          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Prendas a enviar ({pendingOrders.length})
            </h2>
            <div className="space-y-3">
              {pendingOrders.map(order => {
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
                        <p className="text-sm font-medium truncate">{order.listing?.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Compradora: {order.buyer?.name ?? '—'}</p>
                        <p className="text-sm font-semibold mt-1">
                          ${(order.amount - order.commission - order.processing_fee).toLocaleString('es-CL')}
                          <span className="text-xs font-normal text-gray-400 ml-1">(neto)</span>
                        </p>

                        <div className="bg-gray-50 p-3 mt-3 text-xs text-gray-600 space-y-0.5">
                          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Enviar a</p>
                          <p className="font-medium text-gray-700">{order.shipping_name} · {order.shipping_phone}</p>
                          <p>{order.shipping_address}{order.shipping_address_extra && `, ${order.shipping_address_extra}`}</p>
                          <p>{order.shipping_comuna}, {order.shipping_city}</p>
                        </div>

                        {order.label_url ? (
                          <a
                            href={`/api/orders/${order.id}/label/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full text-center bg-black text-white text-xs tracking-widest uppercase py-3 mt-3 hover:bg-gray-800 transition"
                          >
                            Descargar etiqueta
                          </a>
                        ) : (
                          <GenerateLabelButton orderId={order.id} />
                        )}
                        <p className="text-[10px] tracking-widest uppercase text-gray-400 mt-3 mb-1">
                          ¿Ya tienes el número de seguimiento?
                        </p>
                        <AddTrackingForm orderId={order.id} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Etiqueta generada, falta despachar en sucursal */}
        {shippedOrders.length > 0 && (
          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Con etiqueta, falta despachar ({shippedOrders.length})
            </h2>
            <div className="space-y-3">
              {shippedOrders.map(order => {
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
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium truncate">{order.listing?.title}</p>
                          <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-amber-50 text-amber-600 whitespace-nowrap flex-shrink-0">
                            En camino
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Compradora: {order.buyer?.name ?? '—'}</p>
                        {order.courier_tracking_number && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Seguimiento: <span className="font-mono">{order.courier_tracking_number}</span>
                          </p>
                        )}
                        <p className="text-sm font-semibold mt-1">
                          ${(order.amount - order.commission - order.processing_fee).toLocaleString('es-CL')}
                          <span className="text-xs font-normal text-gray-400 ml-1">(neto)</span>
                        </p>
                        {order.label_url && (
                          <a href={order.label_url} target="_blank" rel="noopener noreferrer"
                            className="inline-block mt-2 text-[10px] tracking-widest uppercase text-gray-500 hover:text-black underline">
                            Ver / reimprimir etiqueta
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Confirmadas por la compradora, liberando pago */}
        {deliveredOrders.length > 0 && (
          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Confirmadas, liberando pago ({deliveredOrders.length})
            </h2>
            <div className="space-y-3">
              {deliveredOrders.map(order => {
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
                        <p className="text-sm font-medium truncate">{order.listing?.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Compradora: {order.buyer?.name ?? '—'}</p>
                        <p className="text-sm font-semibold mt-1">
                          ${(order.amount - order.commission - order.processing_fee).toLocaleString('es-CL')}
                          <span className="text-xs font-normal text-gray-400 ml-1">(neto)</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          La compradora confirmó la recepción. Si no reporta un problema, el pago se libera en{' '}
                          {daysUntilRelease(order.confirmed_at)}.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Historial */}
        {completedOrders.length > 0 && (
          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Ventas completadas ({completedOrders.length})
            </h2>
            <div className="space-y-2">
              {completedOrders.map(order => (
                <div key={order.id} className="bg-white p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{order.listing?.title ?? 'Prenda eliminada'}</p>
                    <p className="text-xs text-gray-400">{order.buyer?.name ?? '—'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">${(order.amount - order.commission - order.processing_fee).toLocaleString('es-CL')}</p>
                    <p className="text-[10px] text-gray-300">
                      {new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
              {completedOrders.map(order => (
                reviewedOrderIds.has(order.id) ? null : (
                  <div key={`review-${order.id}`} className="bg-white p-4">
                    <p className="text-xs text-gray-500 mb-1">{order.listing?.title ?? 'Prenda eliminada'}</p>
                    <ReviewForm
                      orderId={order.id}
                      reviewedId={order.buyer_id}
                      reviewedName={order.buyer?.name ?? 'la compradora'}
                    />
                  </div>
                )
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
