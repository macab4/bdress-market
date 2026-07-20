import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  await requireAdminUser()
  const { q, filter } = await searchParams
  const admin = createAdminClient()

  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('profiles').select('id, name, city, created_at, legacy_seller'),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const legacyIds = (profiles ?? []).filter(p => p.legacy_seller).map(p => p.id)

  const { data: legacyListings } = legacyIds.length
    ? await admin.from('listings').select('seller_id, status').in('seller_id', legacyIds)
    : { data: [] as { seller_id: string; status: string }[] }

  const publishedCount = new Map<string, number>()
  for (const l of legacyListings ?? []) {
    if (l.status === 'active') publishedCount.set(l.seller_id, (publishedCount.get(l.seller_id) ?? 0) + 1)
  }

  let users = authData.users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    activated: !!u.last_sign_in_at,
    name: profileMap.get(u.id)?.name ?? '(sin perfil)',
    city: profileMap.get(u.id)?.city ?? null,
    created_at: u.created_at,
    legacySeller: profileMap.get(u.id)?.legacy_seller ?? false,
    published: publishedCount.get(u.id) ?? 0,
  }))

  if (filter === 'pending') {
    users = users.filter(u => !u.activated)
  } else if (filter === 'migracion') {
    users = users.filter(u => u.legacySeller)
  }

  if (q) {
    const needle = q.toLowerCase()
    users = users.filter(u => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
  }

  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const legacyTotal = legacyIds.length
  const legacyActivated = (profiles ?? []).filter(p => p.legacy_seller && authData.users.find(u => u.id === p.id)?.last_sign_in_at).length
  const legacyPublished = legacyIds.filter(id => (publishedCount.get(id) ?? 0) > 0).length

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/users" />
        </div>

        <form method="GET" className="mb-6 flex gap-4 items-center flex-wrap">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email..."
            className="w-full max-w-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
          />
          <input type="hidden" name="filter" value={filter ?? ''} />
        </form>

        <div className="flex gap-6 mb-4">
          <Link
            href={{ pathname: '/admin/users', query: q ? { q } : {} }}
            className={`text-[10px] tracking-widest uppercase pb-1 ${!filter ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
          >
            Todas
          </Link>
          <Link
            href={{ pathname: '/admin/users', query: q ? { q, filter: 'pending' } : { filter: 'pending' } }}
            className={`text-[10px] tracking-widest uppercase pb-1 ${filter === 'pending' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
          >
            Pendientes de activar
          </Link>
          <Link
            href={{ pathname: '/admin/users', query: q ? { q, filter: 'migracion' } : { filter: 'migracion' } }}
            className={`text-[10px] tracking-widest uppercase pb-1 ${filter === 'migracion' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
          >
            Migración ({legacyTotal})
          </Link>
        </div>

        {filter === 'migracion' && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Correo enviado</p>
              <p className="text-xl font-light">{legacyTotal}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Activó cuenta</p>
              <p className="text-xl font-light">{legacyActivated} <span className="text-sm text-gray-400">/ {legacyTotal}</span></p>
            </div>
            <div className="bg-white p-5">
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Publicó al menos 1 prenda</p>
              <p className="text-xl font-light">{legacyPublished} <span className="text-sm text-gray-400">/ {legacyTotal}</span></p>
            </div>
          </div>
        )}

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Usuarias ({users.length})
        </h2>

        <div className="bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Ciudad</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Activó cuenta</th>
                {filter === 'migracion' && <th className="text-left px-4 py-3">Publicó</th>}
                <th className="text-left px-4 py-3">Miembro desde</th>
                <th className="text-left px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500">{u.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${u.banned ? 'bg-red-50 text-red-600' : 'bg-[#7fab87]/10 text-[#5a7a55]'}`}>
                      {u.banned ? 'Suspendida' : 'Activa'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${u.activated ? 'bg-[#7fab87]/10 text-[#5a7a55]' : 'bg-gray-100 text-gray-400'}`}>
                      {u.activated ? 'Sí' : 'Pendiente'}
                    </span>
                  </td>
                  {filter === 'migracion' && (
                    <td className="px-4 py-3">
                      <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${u.published > 0 ? 'bg-[#7fab87]/10 text-[#5a7a55]' : 'bg-gray-100 text-gray-400'}`}>
                        {u.published > 0 ? `Sí (${u.published})` : 'No'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
