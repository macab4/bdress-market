import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface SellerRating {
  avg: number
  count: number
}

export async function getSellerRatings(
  supabase: SupabaseServerClient,
  sellerIds: string[]
): Promise<Record<string, SellerRating>> {
  const uniqueIds = Array.from(new Set(sellerIds))
  if (uniqueIds.length === 0) return {}

  const { data } = await supabase
    .from('reviews')
    .select('reviewed_id, rating')
    .in('reviewed_id', uniqueIds) as unknown as { data: { reviewed_id: string; rating: number }[] | null }

  const totals: Record<string, { sum: number; count: number }> = {}
  for (const r of data ?? []) {
    const entry = totals[r.reviewed_id] ?? { sum: 0, count: 0 }
    entry.sum += r.rating
    entry.count += 1
    totals[r.reviewed_id] = entry
  }

  const ratings: Record<string, SellerRating> = {}
  for (const [id, { sum, count }] of Object.entries(totals)) {
    ratings[id] = { avg: sum / count, count }
  }
  return ratings
}
