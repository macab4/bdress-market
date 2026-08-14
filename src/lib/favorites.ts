import { createAdminClient } from '@/lib/supabase/admin'

// Cuenta pública de favoritos por listing, para mostrar en las cards (junto
// al corazón). La RLS de `favorites` solo deja ver las propias filas
// (auth.uid() = user_id) — acá se necesita el total real entre todas las
// usuarias, así que se usa el cliente admin (mismo patrón que ya usa
// profile/[id]/page.tsx para leer orders/messages de otra usuaria). Solo se
// lee `listing_id`, nunca `user_id`, y se agrega a un conteo en el servidor
// antes de que llegue nada al cliente — el número es público, pero quién
// marcó qué sigue siendo privado. Una sola query en batch, sin N+1.
export async function getFavoriteCounts(listingIds: string[]): Promise<Record<string, number>> {
  if (listingIds.length === 0) return {}

  const admin = createAdminClient()
  const { data } = await admin.from('favorites').select('listing_id').in('listing_id', listingIds)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) counts[row.listing_id] = (counts[row.listing_id] ?? 0) + 1
  return counts
}
