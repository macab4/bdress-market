import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Listing, Order } from '@/types'
import PauseListingButton from '@/components/dashboard/PauseListingButton'
import DeleteListingButton from '@/components/dashboard/DeleteListingButton'
import GenerateLabelButton from '@/components/dashboard/GenerateLabelButton'
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

  const [listingsResult, ordersResult] = await Promise.all([
    supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('*, listing:listings(title, photos), buyer:profiles!orders_buyer_id_fkey(name)')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const listings = (listingsResult.data ?? []) as Listing[]
  const orders = (ordersResult.data ?? []) as OrderWithRelations[]

  const { data: myReviews } = await supabase
    .from('reviews')
    .select('order_id')
    .eq('reviewer_id', user.id)
  const reviewedOrderIds = new Set((myReviews ?? []).map(r => r.order_id))

  const activeListings = listings.filter(l => l.status === 'active' || l.status === 'paused')

  type RepopOrder = { id: string; amount: number; listing: { title: string; brand: string; photos: string[] } | null }
  let repopOrders: RepopOrder[] = []
  if (activeListings.length === 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, amount, listing:listings(title, brand, photos)')
      .eq('buyer_id', user.id)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false })
      .limit(4) as unknown as { data: RepopOrder[] | null }
    repopOrders = data ?? []
  }
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

                        <GenerateLabelButton orderId={order.id} />
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

        {/* Mis prendas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400">
              Mis prendas ({activeListings.length})
            </h2>
            <Link href="/listings/new"
              className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#6f9678] transition">
              + Publicar
            </Link>
          </div>

          {activeListings.length === 0 ? (
            <div className="bg-white p-10 text-center">
              <p className="text-sm text-gray-400 mb-4">Aún no tienes prendas publicadas.</p>

              {repopOrders.length > 0 && (
                <div className="mt-6 text-left">
                  <p className="text-xs font-medium mb-1">¿No sabes qué publicar?</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Revende algo que ya compraste — precargamos los datos por ti.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {repopOrders.map(order => {
                      const photo = order.listing?.photos?.[0]
                      return (
                        <div key={order.id} className="text-left">
                          <div className="aspect-square bg-gray-100 relative overflow-hidden mb-2">
                            {photo ? (
                              <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                            )}
                          </div>
                          <p className="text-xs font-medium truncate">{order.listing?.brand || order.listing?.title}</p>
                          <p className="text-[10px] text-gray-400 mb-2">
                            Comprado: ${order.amount.toLocaleString('es-CL')}
                          </p>
                          <Link
                            href={`/listings/new?fromOrder=${order.id}`}
                            className="block text-center bg-[#7fab87] text-white text-[9px] tracking-widest uppercase py-2 hover:bg-[#6f9678] transition"
                          >
                            Revender
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {activeListings.map(listing => {
                const photo = listing.photos?.[0]
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
                      <p className="text-xs text-gray-400">{listing.brand} · T. {listing.size}</p>
                      <p className="text-sm font-semibold mt-0.5">${listing.price.toLocaleString('es-CL')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${
                          listing.status === 'active' ? 'bg-[#7fab87]/10 text-[#5a7a55]' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {listing.status === 'active' ? 'Activa' : 'Pausada'}
                        </span>
                        <Link href={`/listings/${listing.id}/edit`}
                          className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-3 py-1.5 hover:bg-[#6f9678] transition">
                          Editar
                        </Link>
                      </div>
                      <div className="flex items-center gap-3">
                        <PauseListingButton listingId={listing.id} currentStatus={listing.status as 'active' | 'paused'} />
                        <Link href={`/listings/${listing.id}`}
                          className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black">
                          Ver
                        </Link>
                        <DeleteListingButton listingId={listing.id} listingTitle={listing.title} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

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
