import Link from 'next/link'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import MarkFlagReviewed from '@/components/admin/MarkFlagReviewed'
import { REPEAT_OFFENDER_THRESHOLD } from '@/lib/messageModeration'

type FlagRow = {
  id: string
  sender_id: string
  receiver_id: string
  listing_id: string
  content: string
  reason: string
  reviewed_at: string | null
  created_at: string
  listing: { title: string; seller_id: string } | null
  sender: { name: string; email: string } | null
  receiver: { name: string } | null
}

type MessageRow = {
  id: string
  sender_id: string
  receiver_id: string
  listing_id: string
  content: string
  created_at: string
  listing: { title: string; seller_id: string } | null
  sender: { name: string } | null
  receiver: { name: string } | null
}

interface Conversation {
  listingId: string
  listingTitle: string
  buyerId: string
  buyerName: string
  sellerName: string
  lastContent: string
  lastCreatedAt: string
}

export default async function AdminMessagesPage() {
  await requireAdminUser()
  const admin = createAdminClient()

  const [{ data: flags }, { data: messages }, { data: allFlagSenders }] = await Promise.all([
    admin
      .from('message_flags')
      .select(`
        id, sender_id, receiver_id, listing_id, content, reason, reviewed_at, created_at,
        listing:listings(title, seller_id),
        sender:profiles!message_flags_sender_id_fkey(name, email),
        receiver:profiles!message_flags_receiver_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200) as unknown as Promise<{ data: FlagRow[] | null }>,
    admin
      .from('messages')
      .select(`
        id, sender_id, receiver_id, listing_id, content, created_at,
        listing:listings(title, seller_id),
        sender:profiles!messages_sender_id_fkey(name),
        receiver:profiles!messages_receiver_id_fkey(name)
      `)
      .order('created_at', { ascending: false })
      .limit(500) as unknown as Promise<{ data: MessageRow[] | null }>,
    // Conteo de reincidencia — se hace aparte de la lista de arriba (que solo
    // trae las últimas 200) para reflejar el total histórico real.
    admin.from('message_flags').select('sender_id') as unknown as Promise<{ data: { sender_id: string }[] | null }>,
  ])

  const flagCounts = new Map<string, number>()
  for (const row of allFlagSenders ?? []) {
    flagCounts.set(row.sender_id, (flagCounts.get(row.sender_id) ?? 0) + 1)
  }

  const flagList = flags ?? []
  const pendingFlags = flagList.filter(f => !f.reviewed_at)
  const reviewedFlags = flagList.filter(f => f.reviewed_at)

  const conversations = new Map<string, Conversation>()
  for (const m of messages ?? []) {
    if (!m.listing) continue
    const sellerId = m.listing.seller_id
    const buyerId = m.sender_id === sellerId ? m.receiver_id : m.sender_id
    const key = `${m.listing_id}:${buyerId}`
    if (!conversations.has(key)) {
      conversations.set(key, {
        listingId: m.listing_id,
        listingTitle: m.listing.title,
        buyerId,
        buyerName: (m.sender_id === buyerId ? m.sender?.name : m.receiver?.name) ?? '—',
        sellerName: (m.sender_id === sellerId ? m.sender?.name : m.receiver?.name) ?? '—',
        lastContent: m.content,
        lastCreatedAt: m.created_at,
      })
    }
  }
  const conversationList = Array.from(conversations.values())

  function renderFlagCard(f: FlagRow) {
    const sellerId = f.listing?.seller_id
    const buyerId = f.sender_id === sellerId ? f.receiver_id : f.sender_id
    const senderFlagCount = flagCounts.get(f.sender_id) ?? 1
    const reviewed = !!f.reviewed_at

    return (
      <div key={f.id} className={`bg-white p-4 md:p-5 ${reviewed ? 'opacity-60' : ''}`}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-sm font-medium">
              {f.sender?.name ?? '—'} <span className="text-gray-400 font-normal">→ {f.receiver?.name ?? '—'}</span>
              {senderFlagCount > 1 && (
                <span className={`ml-2 text-[9px] tracking-widest uppercase px-1.5 py-0.5 ${
                  senderFlagCount >= REPEAT_OFFENDER_THRESHOLD
                    ? 'bg-red-100 text-red-700 font-semibold'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {senderFlagCount} alertas totales
                </span>
              )}
            </p>
            <p className="text-xs text-gray-400">{f.sender?.email}</p>
            <p className="text-xs text-gray-400">{f.listing?.title ?? 'Prenda eliminada'}</p>
          </div>
          <span className="text-[9px] tracking-widest uppercase px-2 py-0.5 bg-red-50 text-red-600 whitespace-nowrap flex-shrink-0">
            {f.reason}
          </span>
        </div>
        <p className="text-sm text-gray-700 bg-gray-50 p-2.5 mb-2">&quot;{f.content}&quot;</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-gray-300">
            {new Date(f.created_at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex items-center gap-3 flex-shrink-0">
            {sellerId && (
              <Link
                href={`/admin/messages/${f.listing_id}/${buyerId}`}
                className="text-[10px] tracking-widest uppercase text-[#8DA988] hover:underline"
              >
                Ver conversación
              </Link>
            )}
            <MarkFlagReviewed flagId={f.id} reviewed={reviewed} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
        <AdminNav active="/admin/messages" />

        <section className="mb-10">
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Alertas pendientes ({pendingFlags.length})
          </h2>
          {pendingFlags.length > 0 ? (
            <div className="space-y-2">{pendingFlags.map(renderFlagCard)}</div>
          ) : (
            <div className="bg-white p-10 text-center">
              <p className="text-sm text-gray-400">Sin alertas pendientes — nadie intentó compartir contacto o pago fuera de la plataforma sin revisar.</p>
            </div>
          )}
        </section>

        {reviewedFlags.length > 0 && (
          <section className="mb-10">
            <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
              Ya revisadas ({reviewedFlags.length})
            </h2>
            <div className="space-y-2">{reviewedFlags.map(renderFlagCard)}</div>
          </section>
        )}

        <section>
          <h2 className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Todas las conversaciones ({conversationList.length})
          </h2>
          {conversationList.length > 0 ? (
            <div className="bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] tracking-widest uppercase text-gray-400">
                    <th className="text-left p-3">Prenda</th>
                    <th className="text-left p-3">Compradora</th>
                    <th className="text-left p-3">Vendedora</th>
                    <th className="text-left p-3">Último mensaje</th>
                    <th className="text-left p-3">Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {conversationList.map(c => (
                    <tr key={`${c.listingId}:${c.buyerId}`} className="border-b border-gray-50 last:border-0">
                      <td className="p-3 truncate max-w-[160px]">{c.listingTitle}</td>
                      <td className="p-3 whitespace-nowrap">{c.buyerName}</td>
                      <td className="p-3 whitespace-nowrap">{c.sellerName}</td>
                      <td className="p-3 text-gray-400 truncate max-w-[220px]">{c.lastContent}</td>
                      <td className="p-3 text-gray-400 whitespace-nowrap">
                        {new Date(c.lastCreatedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/admin/messages/${c.listingId}/${c.buyerId}`} className="text-[10px] tracking-widest uppercase text-[#8DA988] hover:underline whitespace-nowrap">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white p-10 text-center">
              <p className="text-sm text-gray-400">Todavía no hay conversaciones.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
