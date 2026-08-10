import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Order } from '@/types'
import { ORDER_STATUS_CONFIG, shipDeadline } from '@/lib/catalog'
import AdminNav from '@/components/admin/AdminNav'
import UploadLabelForm from '@/components/admin/UploadLabelForm'

type AdminOrderDetail = Order & {
  listing: { title: string; photos: string[]; shipping_size: string } | null
  buyer: { name: string; email: string } | null
  seller: { name: string; email: string; phone: string | null; address: string | null; comuna: string | null }
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isPast(date: Date) {
  return date.getTime() < Date.now()
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('*, listing:listings(title, photos, shipping_size), buyer:profiles!orders_buyer_id_fkey(name, email), seller:profiles!orders_seller_id_fkey(name, email, phone, address, comuna)')
    .eq('id', id)
    .single() as unknown as { data: AdminOrderDetail | null }

  if (!order) notFound()

  const status = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
  const photo = order.listing?.photos?.[0]
  const needsLabel = order.status === 'paid' && !order.label_url
  const awaitingDispatch = order.status === 'paid' && !!order.label_url
  const deadline = order.paid_at ? shipDeadline(order.paid_at) : null
  const deadlinePassed = deadline ? isPast(deadline) : false

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin" />
        </div>

        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          <Link href="/admin#ordenes" className="hover:text-black">Órdenes</Link> · {order.id}
        </p>

        {/* Encabezado */}
        <div className="bg-white p-5 flex gap-4 mb-6">
          <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
            {photo ? (
              <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{order.listing?.title ?? 'Prenda eliminada'}</p>
              <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-lg font-light mt-1">${(order.amount + order.shipping_cost).toLocaleString('es-CL')}</p>
            <Link href={`/listings/${order.listing_id}`} className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black">
              Ver prenda
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Compra */}
          <section className="bg-white p-5 space-y-2 text-sm">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Compra</p>
            <div className="flex justify-between"><span className="text-gray-400">Compradora</span><span>{order.buyer?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="truncate ml-2">{order.buyer?.email ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Vendedora</span><span>{order.seller?.name ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Prenda + Protección</span><span>${order.amount.toLocaleString('es-CL')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Envío</span><span>${order.shipping_cost.toLocaleString('es-CL')}</span></div>
            <div className="flex justify-between font-medium border-t border-gray-100 pt-2"><span>Total cobrado</span><span>${(order.amount + order.shipping_cost).toLocaleString('es-CL')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Protección Bdress</span><span>${order.commission.toLocaleString('es-CL')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Procesamiento pago</span><span>${order.processing_fee.toLocaleString('es-CL')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Pagado</span><span>{formatDate(order.paid_at)}</span></div>
          </section>

          {/* Envío */}
          <section className="bg-white p-5 space-y-3 text-sm">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Envío</p>

            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Retiro (vendedora)</p>
              <p>{order.seller?.name} · {order.seller?.phone ?? 'sin teléfono'}</p>
              <p className="text-gray-500">{order.seller?.address ?? '—'}{order.seller?.comuna ? `, ${order.seller.comuna}` : ''}</p>
            </div>

            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Entrega (compradora)</p>
              <p>{order.shipping_name} · {order.shipping_phone}</p>
              <p className="text-gray-500">
                {order.shipping_address}{order.shipping_address_extra ? `, ${order.shipping_address_extra}` : ''}, {order.shipping_comuna}
              </p>
            </div>

            <p className="text-xs text-gray-400">Tamaño: {order.listing?.shipping_size ?? '—'}</p>

            {deadline && (
              <p className={`text-xs ${deadlinePassed && order.status === 'paid' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                Plazo de despacho: {deadline.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                {deadlinePassed && order.status === 'paid' ? ' — vencido' : ''}
              </p>
            )}

            {awaitingDispatch && (
              <p className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-amber-50 text-amber-600 inline-block">
                Esperando despacho de la vendedora
              </p>
            )}

            {order.label_courier && order.label_tracking_number && (
              <div className="bg-gray-50 p-3 text-xs text-gray-600 space-y-0.5">
                <p><span className="text-gray-400">Transportista:</span> {order.label_courier}</p>
                <p><span className="text-gray-400">N.º de seguimiento:</span> <span className="font-mono">{order.label_tracking_number}</span></p>
                {order.label_uploaded_at && (
                  <p className="text-[10px] text-gray-400">Etiqueta enviada: {formatDate(order.label_uploaded_at)}</p>
                )}
              </div>
            )}

            {order.tracking_number && (
              <p className="text-xs text-gray-500">Seguimiento (despacho confirmado): <span className="font-mono">{order.tracking_number}</span></p>
            )}

            {order.label_url && (
              <div className="flex items-center gap-3">
                <a href={order.label_url} target="_blank" rel="noopener noreferrer"
                  className="inline-block text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline">
                  Ver etiqueta enviada
                </a>
                <span className="text-[10px] text-gray-400">
                  {order.label_downloaded_at ? `Descargada el ${formatDate(order.label_downloaded_at)}` : 'Todavía no descargada'}
                </span>
              </div>
            )}

            {needsLabel && (
              <div className="border-t border-gray-100 pt-3 mt-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Subir etiqueta (modo manual)</p>
                <UploadLabelForm orderId={order.id} sellerEmail={order.seller?.email ?? null} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
