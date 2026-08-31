import { createAdminClient } from '@/lib/supabase/admin'
import { sendNewListingsDigestEmail } from '@/lib/email'

// Se ejecuta diariamente vía Vercel Cron (ver vercel.json). Junta todas las
// notificaciones tipo 'new_listing' sin correo mandado aún (emailed_at is
// null — ver migración 20260828020000), las agrupa por compradora y manda
// un solo digest por persona. La notificación in-app ya existía (trigger
// notify_followers_new_listing en supabase-schema.sql); esto solo agrega el
// aviso por correo.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: pending, error } = await admin
    .from('notifications')
    .select('id, user_id, actor_id, listing_id')
    .eq('type', 'new_listing')
    .is('emailed_at', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return Response.json({ sent: 0 })
  }

  const byUser = new Map<string, typeof pending>()
  for (const n of pending) {
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, [])
    byUser.get(n.user_id)!.push(n)
  }

  const listingIds = [...new Set(pending.map(n => n.listing_id).filter((id): id is string => !!id))]
  const sellerIds = [...new Set(pending.map(n => n.actor_id))]
  const userIds = [...byUser.keys()]

  const [{ data: listings }, { data: sellers }, { data: buyers }] = await Promise.all([
    admin.from('listings').select('id, title, price, photos, status').in('id', listingIds),
    admin.from('profiles').select('id, name').in('id', sellerIds),
    admin.from('profiles').select('id, name, email').in('id', userIds),
  ])

  const listingMap = new Map((listings ?? []).map(l => [l.id, l]))
  const sellerMap = new Map((sellers ?? []).map(s => [s.id, s]))
  const buyerMap = new Map((buyers ?? []).map(b => [b.id, b]))

  let sent = 0
  await Promise.all([...byUser.entries()].map(async ([userId, notifs]) => {
    const buyer = buyerMap.get(userId)
    // Solo se cuentan prendas que sigan activas — si ya se vendió o pausó
    // en el rato que pasó desde que se publicó, no vale la pena mandarla en
    // el resumen.
    const items = notifs
      .map(n => {
        const listing = n.listing_id ? listingMap.get(n.listing_id) : null
        if (!listing || listing.status !== 'active') return null
        return {
          listingId: listing.id,
          listingTitle: listing.title,
          sellerName: sellerMap.get(n.actor_id)?.name ?? null,
          price: listing.price,
          photo: listing.photos?.[0] ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    if (items.length > 0 && buyer?.email) {
      await sendNewListingsDigestEmail({ to: buyer.email, name: buyer.name, items })
      sent++
    }
  }))

  await admin
    .from('notifications')
    .update({ emailed_at: new Date().toISOString() })
    .in('id', pending.map(n => n.id))

  return Response.json({ sent, notificationsProcessed: pending.length })
}
