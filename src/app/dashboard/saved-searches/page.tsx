import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SavedSearch } from '@/types'
import DeleteSavedSearchButton from '@/components/dashboard/DeleteSavedSearchButton'

export default async function SavedSearchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const searches = (data ?? []) as SavedSearch[]

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mis búsquedas guardadas</h1>

        {searches.length > 0 ? (
          <div className="space-y-2">
            {searches.map(search => (
              <div key={search.id} className="bg-white p-4 flex items-center justify-between gap-4">
                <Link href={`/?${search.params}`} className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{search.label || 'Todas las prendas'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(search.created_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </Link>
                <Link href={`/?${search.params}`}
                  className="text-[10px] tracking-widest uppercase text-white bg-[#7fab87] hover:bg-[#6f9678] px-3 py-1.5 flex-shrink-0">
                  Ver
                </Link>
                <DeleteSavedSearchButton id={search.id} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 text-center">
            <p className="text-gray-400 text-sm mb-2">Todavía no tienes búsquedas guardadas.</p>
            <p className="text-gray-400 text-xs">
              Filtra el catálogo como quieras y usa &quot;Guardar búsqueda&quot; para volver a ella después.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
