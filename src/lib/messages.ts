import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

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

type OfferRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  offered_price: number
  proposed_by: 'buyer' | 'seller'
  created_at: string
  listing: { title: string; photos: string[] } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

export interface Conversation {
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

// Compartido entre la bandeja (/dashboard/messages) y el hilo individual
// (que en desktop muestra la bandeja al lado) para que las dos vistas
// siempre armen exactamente la misma lista de conversaciones.
export async function getConversations(supabase: SupabaseClient, userId: string): Promise<Conversation[]> {
  const [{ data: messages, error: messagesError }, { data: offers, error: offersError }] = await Promise.all([
    supabase
      .from('messages')
      .select(`
        id, sender_id, receiver_id, listing_id, content, read_at, created_at,
        listing:listings(title, photos),
        sender:profiles!messages_sender_id_fkey(name),
        receiver:profiles!messages_receiver_id_fkey(name)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false }) as unknown as { data: MessageRow[] | null; error: { message: string } | null },
    supabase
      .from('offers')
      .select(`
        id, listing_id, buyer_id, seller_id, offered_price, proposed_by, created_at,
        listing:listings(title, photos),
        buyer:profiles!offers_buyer_id_fkey(name),
        seller:profiles!offers_seller_id_fkey(name)
      `)
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order('created_at', { ascending: false }) as unknown as { data: OfferRow[] | null; error: { message: string } | null },
  ])

  if (messagesError) console.error('Error al cargar mensajes del inbox:', messagesError.message)
  if (offersError) console.error('Error al cargar ofertas del inbox:', offersError.message)

  // Un hilo puede tener solo ofertas y ningún mensaje de texto todavía —
  // por eso se combinan ambas fuentes para armar la lista de conversaciones,
  // en vez de mirar solo la tabla messages.
  type Activity = {
    createdAt: string
    listingId: string
    listingTitle: string
    listingPhoto?: string
    otherId: string
    otherName: string
    preview: string
    fromMe: boolean
    isUnreadMessage: boolean
  }

  const activities: Activity[] = [
    ...(messages ?? []).map((m): Activity => {
      const fromMe = m.sender_id === userId
      return {
        createdAt: m.created_at,
        listingId: m.listing_id,
        listingTitle: m.listing?.title ?? 'Prenda',
        listingPhoto: m.listing?.photos?.[0],
        otherId: fromMe ? m.receiver_id : m.sender_id,
        otherName: (fromMe ? m.receiver?.name : m.sender?.name) ?? '—',
        preview: m.content,
        fromMe,
        isUnreadMessage: m.receiver_id === userId && !m.read_at,
      }
    }),
    ...(offers ?? []).map((o): Activity => {
      const isBuyer = o.buyer_id === userId
      const fromMe = (isBuyer && o.proposed_by === 'buyer') || (!isBuyer && o.proposed_by === 'seller')
      return {
        createdAt: o.created_at,
        listingId: o.listing_id,
        listingTitle: o.listing?.title ?? 'Prenda',
        listingPhoto: o.listing?.photos?.[0],
        otherId: isBuyer ? o.seller_id : o.buyer_id,
        otherName: (isBuyer ? o.seller?.name : o.buyer?.name) ?? '—',
        preview: `${fromMe ? 'Ofertaste' : 'Te ofrecieron'} $${o.offered_price.toLocaleString('es-CL')}`,
        fromMe,
        isUnreadMessage: false,
      }
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const conversations = new Map<string, Conversation>()

  for (const a of activities) {
    const key = `${a.listingId}:${a.otherId}`
    const existing = conversations.get(key)
    if (!existing) {
      conversations.set(key, {
        listingId: a.listingId,
        listingTitle: a.listingTitle,
        listingPhoto: a.listingPhoto,
        otherId: a.otherId,
        otherName: a.otherName,
        lastContent: a.preview,
        lastCreatedAt: a.createdAt,
        lastFromMe: a.fromMe,
        unreadCount: a.isUnreadMessage ? 1 : 0,
      })
    } else if (a.isUnreadMessage) {
      existing.unreadCount += 1
    }
  }

  return Array.from(conversations.values())
}
