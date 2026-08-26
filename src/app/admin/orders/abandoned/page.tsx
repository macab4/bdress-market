import Image from 'next/image'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { Order } from '@/types'
import { PENDING_ORDER_EXPIRY_MINUTES } from '@/lib/catalog'
import AdminNav from '@/components/admin/AdminNav'
import AbandonedCartActions from '@/components/admin/AbandonedCartActions'

type AbandonedOrder = Order & {
  listing: { title: string; photos: string[] } | null
  buyer: { name: string; email: string } | null
}

function statusBadge(order: AbandonedOrder) {
  if (order.status === 'pending_payment') return { label: 'Pago pendiente', color: 'bg-gray-100 text-gray-500' }
  if (order.payment_ref) return { label: 'Pago rechazado', color: 'bg-red-50 text-red-600' }
  return { label: 'Expiró sin pagar', color: 'bg-amber-50 text-amber-600' }
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 1) return 'hace menos de 1 hora'
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default async function AdminAbandonedOrdersPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const pendingCutoff = new Date(Date.now() - PENDING_ORDER_EXPIRY_MINUTES * 60 * 1000).toISOString()
  const windowCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: orders } = await admin
    .from('orders')
    .select('*, listing:listings(title, photos), buyer:profiles!orders_buyer_id_fkey(name, email)')
    .is('paid_at', null)
    .gt('created_at', windowCutoff)
    .or(`and(status.eq.pending_payment,created_at.lt.${pendingCutoff}),status.eq.cancelled`)
    .order('created_at', { ascending: false }) as unknown as { data: AbandonedOrder[] | null }

  const all = orders ?? []
  const totalValue = all.reduce((sum, o) => sum + o.amount, 0)
  const withReminder = all.filter(o => o.abandoned_recovery_sent_at).length

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/orders/abandoned" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 text-center">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Carritos abandonados</p>
            <p className="text-lg font-medium">{all.length}</p>
          </div>
          <div className="bg-white p-4 text-center">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Valor total</p>
            <p className="text-lg font-medium">${totalValue.toLocaleString('es-CL')}</p>
          </div>
          <div className="bg-white p-4 text-center">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Con recordatorio</p>
            <p className="text-lg font-medium">{withReminder}</p>
          </div>
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Últimos 30 días
        </h2>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">No hay carritos abandonados en los últimos 30 días.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {all.map(order => {
              const photo = order.listing?.photos?.[0]
              const badge = statusBadge(order)
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{order.listing?.title ?? 'Prenda eliminada'}</p>
                        <span className={`text-[10px] tracking-widest uppercase px-2 py-0.5 ${badge.color}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Compradora: {order.buyer?.name ?? '—'} ({order.buyer?.email ?? '—'}) · {timeAgo(order.created_at)}
                      </p>
                      <p className="text-sm font-semibold mt-1">${order.amount.toLocaleString('es-CL')}</p>

                      {order.abandoned_recovery_sent_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Recordatorio enviado {timeAgo(order.abandoned_recovery_sent_at)}
                        </p>
                      )}

                      <AbandonedCartActions orderId={order.id} alreadySent={!!order.abandoned_recovery_sent_at} />
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
