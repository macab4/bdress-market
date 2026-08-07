import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import BrandActions from '@/components/admin/BrandActions'

export default async function AdminBrandsPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const [{ data: brands }, { data: aliases }, { data: listingBrandIds }] = await Promise.all([
    admin.from('brands').select('id, display_name, slug').order('display_name'),
    admin.from('brand_aliases').select('brand_id, alias'),
    admin.from('listings').select('brand_id').not('brand_id', 'is', null),
  ])

  const aliasesByBrand = new Map<string, string[]>()
  for (const a of aliases ?? []) {
    const list = aliasesByBrand.get(a.brand_id) ?? []
    list.push(a.alias)
    aliasesByBrand.set(a.brand_id, list)
  }
  const countByBrand = new Map<string, number>()
  for (const l of listingBrandIds ?? []) {
    if (!l.brand_id) continue
    countByBrand.set(l.brand_id, (countByBrand.get(l.brand_id) ?? 0) + 1)
  }

  const rows = (brands ?? []).map(b => ({
    ...b,
    aliases: (aliasesByBrand.get(b.id) ?? []).filter(a => a !== b.display_name),
    count: countByBrand.get(b.id) ?? 0,
  }))

  const brandOptions = rows.map(r => ({ id: r.id, display_name: r.display_name }))

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div>
          <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
          <AdminNav active="/admin/marcas" />
        </div>

        <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">Marcas ({rows.length})</h2>

        {rows.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Todavía no hay marcas canónicas — se crean automáticamente al publicar o correr el backfill.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="bg-white p-4 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.display_name}</p>
                  <p className="text-xs text-gray-400">/?brand={r.slug} · {r.count} {r.count === 1 ? 'prenda' : 'prendas'}</p>
                  {r.aliases.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">Alias: {r.aliases.join(', ')}</p>
                  )}
                </div>
                <BrandActions
                  brand={{ id: r.id, display_name: r.display_name, slug: r.slug }}
                  allBrands={brandOptions.filter(o => o.id !== r.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
