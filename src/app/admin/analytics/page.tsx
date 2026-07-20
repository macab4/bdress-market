import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'

const FIVE_MIN_MS = 5 * 60 * 1000
const WINDOW_DAYS = 30

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function AdminAnalyticsPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - FIVE_MIN_MS)
  const today = startOfToday()
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [{ data: recentViews }, { data: windowViews }, { data: orders }] = await Promise.all([
    admin.from('page_views').select('visitor_id').gte('created_at', fiveMinAgo.toISOString()),
    admin.from('page_views').select('visitor_id, path, city, country, created_at').gte('created_at', windowStart.toISOString()).order('created_at', { ascending: false }).limit(20000),
    admin.from('orders').select('status, amount, created_at').gte('created_at', windowStart.toISOString()),
  ])

  const views = windowViews ?? []
  const visitorsNow = new Set((recentViews ?? []).map(v => v.visitor_id)).size

  const todayViews = views.filter(v => new Date(v.created_at) >= today)
  const sessionsToday = new Set(todayViews.map(v => v.visitor_id)).size

  // Nuevas vs. recurrentes: entre quienes visitaron hoy, ¿ya habían visitado antes de hoy?
  const visitorsBeforeToday = new Set(views.filter(v => new Date(v.created_at) < today).map(v => v.visitor_id))
  const todayVisitorIds = new Set(todayViews.map(v => v.visitor_id))
  let returningToday = 0
  todayVisitorIds.forEach(id => { if (visitorsBeforeToday.has(id)) returningToday++ })
  const newToday = todayVisitorIds.size - returningToday

  // Embudo: vieron una prenda / iniciaron compra / completaron — en la ventana de 30 días
  const productViewVisitors = new Set(
    views.filter(v => /^\/listings\/[^/]+$/.test(v.path)).map(v => v.visitor_id)
  ).size
  const allOrders = orders ?? []
  const startedCheckout = allOrders.length
  const purchased = allOrders.filter(o => !['pending_payment', 'cancelled'].includes(o.status)).length

  // Sesiones por ubicación
  const locationCounts = new Map<string, Set<string>>()
  for (const v of views) {
    const label = v.city || v.country || 'Desconocida'
    if (!locationCounts.has(label)) locationCounts.set(label, new Set())
    locationCounts.get(label)!.add(v.visitor_id)
  }
  const topLocations = [...locationCounts.entries()]
    .map(([label, visitors]) => ({ label, count: visitors.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
  const maxLocationCount = topLocations[0]?.count ?? 1

  const totalGMV = allOrders
    .filter(o => !['pending_payment', 'cancelled'].includes(o.status))
    .reduce((sum, o) => sum + o.amount, 0)

  const stats = [
    { label: 'Visitantes ahora (últimos 5 min)', value: visitorsNow },
    { label: 'Sesiones hoy', value: sessionsToday },
    { label: `Ventas (${WINDOW_DAYS} días)`, value: `$${totalGMV.toLocaleString('es-CL')}` },
    { label: `Órdenes (${WINDOW_DAYS} días)`, value: allOrders.length },
  ]

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/analytics" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">{label}</p>
              <p className="text-xl font-light">{value}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Comportamiento de compra ({WINDOW_DAYS} días)
          </h2>
          <div className="bg-white p-6 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Vieron una prenda</p>
              <p className="text-2xl font-light">{productViewVisitors}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Iniciaron compra</p>
              <p className="text-2xl font-light">{startedCheckout}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Compraron</p>
              <p className="text-2xl font-light text-[#5a7a55]">{purchased}</p>
            </div>
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-8">
          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Sesiones por ubicación ({WINDOW_DAYS} días)
            </h2>
            {topLocations.length === 0 ? (
              <div className="bg-white p-6 text-center text-sm text-gray-400">Sin datos todavía.</div>
            ) : (
              <div className="bg-white p-6 space-y-3">
                {topLocations.map(loc => (
                  <div key={loc.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{loc.label}</span>
                      <span className="text-gray-400">{loc.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100">
                      <div className="h-2 bg-[#7fab87]" style={{ width: `${(loc.count / maxLocationCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Nuevas vs. recurrentes (hoy)
            </h2>
            <div className="bg-white p-6">
              {todayVisitorIds.size === 0 ? (
                <p className="text-sm text-gray-400 text-center">Sin visitas hoy todavía.</p>
              ) : (
                <>
                  <div className="flex justify-between text-xs mb-2">
                    <span>Nuevas <span className="text-gray-400">({newToday})</span></span>
                    <span>Recurrentes <span className="text-gray-400">({returningToday})</span></span>
                  </div>
                  <div className="h-3 bg-gray-100 flex overflow-hidden">
                    <div className="h-3 bg-[#7fab87]" style={{ width: `${(newToday / todayVisitorIds.size) * 100}%` }} />
                    <div className="h-3 bg-[#5a7a55]" style={{ width: `${(returningToday / todayVisitorIds.size) * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
