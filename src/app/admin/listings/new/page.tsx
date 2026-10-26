import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import AdminListingForm from '@/components/admin/AdminListingForm'

// Alcanzable con ?seller_id= en la URL (desde el botón "Publicar prenda para
// esta usuaria" en /admin/users/[id]) — no duplicamos acá el buscador de
// usuarias que ya existe en /admin/users. Sin seller_id, se asume que la
// admin está publicando a su propio nombre (stock propio, p.ej. importado
// desde Shopify — ver "Importar desde Shopify" en AdminListingForm).
export default async function AdminNewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ seller_id?: string }>
}) {
  const user = await requireAdminUser()
  const { seller_id } = await searchParams
  const effectiveSellerId = seller_id || user.id
  const admin = createAdminClient()

  const profile = (await admin.from('profiles').select('id, name, email').eq('id', effectiveSellerId).maybeSingle()).data

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/users" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
          {seller_id ? 'Publicar prenda para una usuaria' : 'Publicar prenda propia'}
        </h2>

        {!profile ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400 mb-4">
              {seller_id ? 'No se encontró esa usuaria.' : 'No se encontró tu propio perfil.'}
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
