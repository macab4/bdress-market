import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import InternationalOrderActions from '@/components/admin/InternationalOrderActions'
import { INTERNATIONAL_STATUS_CONFIG, isPastEstimatedDelivery } from '@/lib/international/status'
import { estimatedMargin, realMargin } from '@/lib/international/margin'
import { InternationalStatus } from '@/types'

interface OrderRow {
  id: string
  amount: number
  status: string
  international_status: InternationalStatus
  created_at: string
  paid_at: string | null
  buyer: { name: string; email: string } | null
  listing: {
    title: string
    price: number
    international_lead_time_max_days: number | null
    sourcing: {
      source_url: string | null
      source_status: string
      external_purchase_price: number | null
      international_cost_estimate: number | null
      international_customs_estimate: number | null
      external_order_reference: string | null
      external_tracking_number: string | null
    } | null
  } | null
}

// Prioriza lo urgente: órdenes recién pagadas esperando validación manual
// van primero (sección 9 del encargo).
const PRIORITY: Record<string, number> = { awaiting_source_verification: 0 }

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

export default async function AdminInternationalOrdersPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const { data: orders } = await admin
    .from('orders')
    .select('id, amount, status, international_status, created_at, paid_at, buyer:profiles!orders_buyer_id_fkey(name, email), listing:listings(title, price, international_lead_time_max_days, sourcing:listing_sourcing(source_url, source_status, external_purchase_price, international_cost_estimate, international_customs_estimate, external_order_reference, external_tracking_number))')
    .not('international_status', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500) as unknown as { data: OrderRow[] | null }

  const all = (orders ?? [])
    .map(o => ({
      ...o,
      buyer: Array.isArray(o.buyer) ? o.buyer[0] ?? null : o.buyer,
      listing: o.listing ? { ...o.listing, sourcing: Array.isArray(o.listing.sourcing) ? o.listing.sourcing[0] ?? null : o.listing.sourcing } : null,
    }))
    .sort((a, b) => (PRIORITY[a.international_status] ?? 1) - (PRIORITY[b.international_status] ?? 1))

  const totalEstimatedMargin = all.reduce((sum, o) => {
    if (!o.listing) return sum
    return sum + estimatedMargin(o.listing.price, o.listing.sourcing?.international_cost_estimate ?? null, o.listing.sourcing?.international_customs_estimate ?? null).margin
  }, 0)
  const cancelledCount = all.filter(o => ['source_unavailable', 'cancellation_pending', 'refund_pending', 'refunded'].includes(o.international_status)).length

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/international" />
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400">Órdenes internacionales ({all.length})</h2>
          <Link href="/admin/international" className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
            Productos internacionales
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4">
            <p className="text-[9px] tracking-widest uppercase text-gray-400">Órdenes pagadas</p>
            <p className="text-lg font-light mt-1">{all.length}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[9px] tracking-widest uppercase text-gray-400">Canceladas / reembolso</p>
            <p className="text-lg font-light mt-1">{cancelledCount}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[9px] tracking-widest uppercase text-gray-400">Margen estimado agregado</p>
            <p className="text-lg font-light mt-1">${totalEstimatedMargin.toLocaleString('es-CL')}</p>
          </div>
        </div>

        {all.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">No hay órdenes internacionales todavía.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {all.map(order => {
              const status = INTERNATIONAL_STATUS_CONFIG[order.international_status]
              const late = isPastEstimatedDelivery(order.paid_at, order.listing?.international_lead_time_max_days, order.international_status)
              const margin = order.listing?.sourcing?.external_purchase_price != null
                ? realMargin(order.listing.price, order.listing.sourcing.external_purchase_price, order.listing.sourcing.international_customs_estimate)
                : order.listing ? estimatedMargin(order.listing.price, order.listing.sourcing?.international_cost_estimate ?? null, order.listing.sourcing?.international_customs_estimate ?? null) : null

              return (
                <div key={order.id} className="bg-white p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{order.listing?.title ?? 'Prenda eliminada'}</p>
                      <p className="text-xs text-gray-400">
                        {order.buyer?.name ?? '—'} ({order.buyer?.email ?? '—'}) · Orden {order.id.slice(0, 8)} · hace {daysSince(order.created_at)} días
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {late && <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-red-50 text-red-600">Atrasado</span>}
                      <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${status.color}`}>{status.label}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
                    <p>Cobrado: <span className="text-black font-medium">${order.amount.toLocaleString('es-CL')}</span></p>
                    {margin && <p>Margen: <span className="text-black font-medium">${margin.margin.toLocaleString('es-CL')}</span></p>}
                    {order.listing?.sourcing?.external_order_reference && <p>Ref. externa: {order.listing.sourcing.external_order_reference}</p>}
                    {order.listing?.sourcing?.external_tracking_number && <p>Tracking intl (interno): {order.listing.sourcing.external_tracking_number}</p>}
                  </div>

                  <InternationalOrderActions orderId={order.id} currentStatus={order.international_status} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
