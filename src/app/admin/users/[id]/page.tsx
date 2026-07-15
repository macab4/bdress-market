import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import SuspendUserButton from '@/components/admin/SuspendUserButton'

type OrderSummary = { id: string; amount: number; status: string; listing: { title: string } | null }

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: authUser }, { data: profile }, { data: listings }, { data: purchases }, { data: sales }] = await Promise.all([
    admin.auth.admin.getUserById(id),
    admin.from('profiles').select('*').eq('id', id).single(),
    admin.from('listings').select('id, title, status, price').eq('seller_id', id),
    admin.from('orders').select('id, amount, status, listing:listings(title)').eq('buyer_id', id) as unknown as Promise<{ data: OrderSummary[] | null }>,
    admin.from('orders').select('id, amount, status, listing:listings(title)').eq('seller_id', id) as unknown as Promise<{ data: OrderSummary[] | null }>,
  ])

  if (!authUser?.user || !profile) notFound()

  const banned = !!authUser.user.banned_until && new Date(authUser.user.banned_until) > new Date()

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/users" />
        </div>

        <div className="bg-white p-6 flex items-start justify-between gap-4 mb-8">
          <div>
            <h2 className="text-lg font-medium">{profile.name}</h2>
            <p className="text-xs text-gray-400">{authUser.user.email}</p>
            {profile.city && <p className="text-xs text-gray-400">{profile.city}</p>}
            <p className="text-[10px] text-gray-400 mt-2">
              Miembro desde {new Date(profile.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <Link href={`/profile/${id}`} className="text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline mt-1 inline-block">
              Ver perfil público
            </Link>
          </div>
          <SuspendUserButton userId={id} banned={banned} />
        </div>

        <section className="mb-8">
          <h3 className="text-[10px] tracking-widest uppercase text-gray-400 mb-3">
            Prendas publicadas ({listings?.length ?? 0})
          </h3>
          {listings && listings.length > 0 ? (
            <div className="space-y-1">
              {listings.map(l => (
                <div key={l.id} className="bg-white p-3 flex items-center justify-between text-sm">
                  <span className="truncate">{l.title}</span>
                  <span className="text-gray-400 text-xs whitespace-nowrap ml-2">{l.status} · ${l.price.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin prendas publicadas.</p>
          )}
        </section>

        <section className="mb-8">
          <h3 className="text-[10px] tracking-widest uppercase text-gray-400 mb-3">
            Compras ({purchases?.length ?? 0})
          </h3>
          {purchases && purchases.length > 0 ? (
            <div className="space-y-1">
              {purchases.map(o => (
                <div key={o.id} className="bg-white p-3 flex items-center justify-between text-sm">
                  <span className="truncate">{o.listing?.title ?? 'Prenda eliminada'}</span>
                  <span className="text-gray-400 text-xs whitespace-nowrap ml-2">{o.status} · ${o.amount.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin compras.</p>
          )}
        </section>

        <section>
          <h3 className="text-[10px] tracking-widest uppercase text-gray-400 mb-3">
            Ventas ({sales?.length ?? 0})
          </h3>
          {sales && sales.length > 0 ? (
            <div className="space-y-1">
              {sales.map(o => (
                <div key={o.id} className="bg-white p-3 flex items-center justify-between text-sm">
                  <span className="truncate">{o.listing?.title ?? 'Prenda eliminada'}</span>
                  <span className="text-gray-400 text-xs whitespace-nowrap ml-2">{o.status} · ${o.amount.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sin ventas.</p>
          )}
        </section>
      </div>
    </div>
  )
}
