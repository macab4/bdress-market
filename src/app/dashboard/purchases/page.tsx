import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Order } from '@/types'
import ConfirmDeliveryButton from '@/components/dashboard/ConfirmDeliveryButton'
import DisputeButton from '@/components/dashboard/DisputeButton'
import ReviewForm from '@/components/reviews/ReviewForm'
import { ORDER_STATUS_CONFIG, daysUntilRelease } from '@/lib/catalog'

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

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('order_id')
    .eq('reviewer_id', user.id)
  const reviewedOrderIds = new Set((myReviews ?? []).map(r => r.order_id))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mis compras</h1>

        {list.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400 mb-4">Aún no has comprado ninguna prenda.</p>
            <Link href="/" className="bg-[#7fab87] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#6f9678] transition">
              Explorar prendas
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((order) => {
              const status = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
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
                          Seguimiento:{' '}
                          <a
                            href="https://www.starken.cl/seguimiento"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#5a7a55] underline underline-offset-2 hover:text-black"
                          >
                            {order.tracking_number}
                          </a>
                          <span className="block text-[10px] text-gray-300 mt-0.5">
                            Pega el número en el buscador de seguimiento de Starken
                          </span>
                        </p>
                      )}

                      {order.status === 'shipped' && (
                        <div className="mt-3">
                          <ConfirmDeliveryButton orderId={order.id} />
                        </div>
                      )}

                      {order.status === 'delivered' && (
                        <p className="text-xs text-gray-400 mt-3">
                          Confirmaste la recepción. Todavía tienes {daysUntilRelease(order.confirmed_at)} para
                          reportar un problema si algo no está bien.
                        </p>
                      )}

                      {['paid', 'shipped', 'delivered'].includes(order.status) && (
                        <div className="mt-3">
                          <DisputeButton orderId={order.id} />
                        </div>
                      )}

                      {order.status === 'disputed' && (
                        <p className="text-xs text-red-500 mt-3">
                          Reportaste un problema con esta compra. Bdress lo va a revisar.
                        </p>
                      )}

                      {order.status === 'completed' && (
                        reviewedOrderIds.has(order.id) ? (
                          <p className="text-xs text-gray-400 mt-3">Ya dejaste tu reseña de esta compra.</p>
                        ) : (
                          <ReviewForm
                            orderId={order.id}
                            reviewedId={order.seller_id}
                            reviewedName={order.seller?.name ?? 'la vendedora'}
                          />
                        )
                      )}

                      {['delivered', 'completed'].includes(order.status) && (
                        <Link
                          href={`/listings/new?fromOrder=${order.id}`}
                          className="inline-block mt-3 text-[10px] tracking-widest uppercase text-[#5a7a55] border border-[#7fab87] px-3 py-1.5 hover:bg-[#7fab87] hover:text-white transition"
                        >
                          Revender esta prenda
                        </Link>
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
