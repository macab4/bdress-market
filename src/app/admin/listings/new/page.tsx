import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import AdminListingForm from '@/components/admin/AdminListingForm'

// Solo alcanzable con ?seller_id= en la URL (por ahora, desde el botón
// "Publicar prenda para esta usuaria" en /admin/users/[id]) — no duplicamos
// acá el buscador de usuarias que ya existe en /admin/users.
export default async function AdminNewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ seller_id?: string }>
}) {
  await requireAdminUser()
  const { seller_id } = await searchParams
  const admin = createAdminClient()

  const profile = seller_id
    ? (await admin.from('profiles').select('id, name, email').eq('id', seller_id).maybeSingle()).data
    : null

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/users" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          Publicar prenda para una usuaria
        </h2>

        {!seller_id || !profile ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400 mb-4">
              {seller_id ? 'No se encontró esa usuaria.' : 'Busca primero a la usuaria en el panel de usuarias.'}
            </p>
            <Link href="/admin/users" className="text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline">
              Ir a Usuarias
            </Link>
          </div>
        ) : (
          <AdminListingForm sellerId={profile.id} sellerName={profile.name || profile.email} />
        )}
      </div>
    </div>
  )
}
