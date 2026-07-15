import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import InboxRefresher from '@/components/messages/InboxRefresher'

type MessageRow = {
  id: string
  sender_id: string
  receiver_id: string
  listing_id: string
  content: string
  read_at: string | null
  created_at: string
  listing: { title: string; photos: string[] } | null
  sender: { name: string } | null
  receiver: { name: string } | null
}

interface Conversation {
  listingId: string
  listingTitle: string
  listingPhoto?: string
  otherId: string
  otherName: string
  lastContent: string
  lastCreatedAt: string
  lastFromMe: boolean
  unreadCount: number
}

export default async function MessagesInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('messages')
    .select(`
      id, sender_id, receiver_id, listing_id, content, read_at, created_at,
      listing:listings(title, photos),
      sender:profiles!messages_sender_id_fkey(name),
      receiver:profiles!messages_receiver_id_fkey(name)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false }) as { data: MessageRow[] | null }

  const conversations = new Map<string, Conversation>()

  for (const m of data ?? []) {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    const key = `${m.listing_id}:${otherId}`
    const isUnreadForMe = m.receiver_id === user.id && !m.read_at

    const existing = conversations.get(key)
    if (!existing) {
      conversations.set(key, {
        listingId: m.listing_id,
        listingTitle: m.listing?.title ?? 'Prenda',
        listingPhoto: m.listing?.photos?.[0],
        otherId,
        otherName: (m.sender_id === user.id ? m.receiver?.name : m.sender?.name) ?? '—',
        lastContent: m.content,
        lastCreatedAt: m.created_at,
        lastFromMe: m.sender_id === user.id,
        unreadCount: isUnreadForMe ? 1 : 0,
      })
    } else if (isUnreadForMe) {
      existing.unreadCount += 1
    }
  }

  const list = Array.from(conversations.values())

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <InboxRefresher />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mensajes</h1>

        {list.length === 0 ? (
          <div className="bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Todavía no tienes conversaciones.</p>
          </div>
        ) : (
          <div className="bg-white divide-y divide-gray-100">
            {list.map(c => (
              <Link
                key={`${c.listingId}:${c.otherId}`}
                href={`/dashboard/messages/${c.listingId}/${c.otherId}`}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 transition"
              >
                <div className="w-12 h-14 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                  {c.listingPhoto ? (
                    <Image src={c.listingPhoto} alt={c.listingTitle} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">Sin foto</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${c.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>{c.otherName}</p>
                    <span className="text-[10px] text-gray-300 flex-shrink-0">
                      {new Date(c.lastCreatedAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{c.listingTitle}</p>
                  <p className={`text-xs truncate mt-0.5 ${c.unreadCount > 0 ? 'text-black font-medium' : 'text-gray-400'}`}>
                    {c.lastFromMe && 'Tú: '}{c.lastContent}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#7fab87] text-white text-[10px] flex items-center justify-center">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
