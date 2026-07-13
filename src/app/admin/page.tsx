import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Order } from '@/types'
import { ORDER_STATUS_CONFIG } from '@/lib/catalog'

type AdminOrder = Order & {
  listing: { title: string } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/')
  }

  const admin = createAdminClient()

  const [{ count: userCount }, { data: listings }, { data: orders }] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('listings').select('status'),
    admin
      .from('orders')
      .select('*, listing:listings(title), buyer:profiles!orders_buyer_id_fkey(name), seller:profiles!orders_seller_id_fkey(name)')
      .order('created_at', { ascending: false })
      .limit(100) as unknown as Promise<{ data: AdminOrder[] | null }>,
  ])

  const allListings = listings ?? []
  const allOrders = orders ?? []

  const activeListings = allListings.filter(l => l.status === 'active').length
  const soldListings = allListings.filter(l => l.status === 'sold').length
  const pausedListings = allListings.filter(l => l.status === 'paused').length

  const realOrders = allOrders.filter(o => o.status !== 'pending_payment' && o.status !== 'cancelled')
  const totalGMV = realOrders.reduce((sum, o) => sum + o.amount, 0)
  const totalCommission = realOrders.reduce((sum, o) => sum + o.commission, 0)

  const stats = [
    { label: 'Usuarias', value: userCount ?? 0 },
    { label: 'Prendas activas', value: activeListings },
    { label: 'Prendas vendidas', value: soldListings },
    { label: 'Prendas pausadas', value: pausedListings },
    { label: 'GMV total', value: `$${totalGMV.toLocaleString('es-CL')}` },
    { label: 'Comisión Bdress', value: `$${totalCommission.toLocaleString('es-CL')}` },
  ]

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <h1 className="text-xl font-light tracking-widest uppercase">Panel de administración</h1>

        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">{label}</p>
              <p className="text-xl font-light">{value}</p>
            </div>
          ))}
        </div>

        {/* Órdenes */}
        <section>
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Órdenes recientes ({allOrders.length})
          </h2>

          {allOrders.length === 0 ? (
            <div className="bg-white p-10 text-center">
              <p className="text-sm text-gray-400">Todavía no hay órdenes.</p>
            </div>
          ) : (
            <div className="bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                    <th className="text-left px-4 py-3">Prenda</th>
                    <th className="text-left px-4 py-3">Compradora</th>
                    <th className="text-left px-4 py-3">Vendedora</th>
                    <th className="text-right px-4 py-3">Monto</th>
                    <th className="text-right px-4 py-3">Comisión</th>
                    <th className="text-left px-4 py-3">Estado</th>
                    <th className="text-left px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {allOrders.map(order => {
                    const status = ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' }
                    return (
                      <tr key={order.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 truncate max-w-[160px]">{order.listing?.title ?? 'Prenda eliminada'}</td>
                        <td className="px-4 py-3 text-gray-500">{order.buyer?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{order.seller?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-right font-medium">${order.amount.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-3 text-right text-gray-500">${order.commission.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(order.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
