import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requireAdminUser()
  const { q } = await searchParams
  const admin = createAdminClient()

  const [{ data: authData }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from('profiles').select('id, name, city, created_at'),
  ])

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  let users = authData.users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    name: profileMap.get(u.id)?.name ?? '(sin perfil)',
    city: profileMap.get(u.id)?.city ?? null,
    created_at: u.created_at,
  }))

  if (q) {
    const needle = q.toLowerCase()
    users = users.filter(u => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle))
  }

  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/users" />
        </div>

        <form method="GET" className="mb-6">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email..."
            className="w-full max-w-sm border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
          />
        </form>

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
                    <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 ${u.banned ? 'bg-red-50 text-red-600' : 'bg-[#8DA988]/10 text-[#5a7a55]'}`}>
                      {u.banned ? 'Suspendida' : 'Activa'}
                    </span>
                  </td>
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
