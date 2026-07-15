import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import MessageComposer from '@/components/messages/MessageComposer'
import ThreadRefresher from '@/components/messages/ThreadRefresher'
import OfferResponseActions from '@/components/dashboard/OfferResponseActions'
import { OFFER_STATUS_CONFIG, OFFER_MAX_ROUNDS, minOfferPrice } from '@/lib/catalog'

type MessageRow = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

type OfferRow = {
  id: string
  buyer_id: string
  seller_id: string
  original_price: number
  offered_price: number
  proposed_by: 'buyer' | 'seller'
  status: string
  round: number
  parent_offer_id: string | null
  expires_at: string
  accepted_expires_at: string | null
  created_at: string
}

type TimelineItem =
  | { type: 'message'; createdAt: string; data: MessageRow }
  | { type: 'offer'; createdAt: string; data: OfferRow }

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ listingId: string; otherUserId: string }>
}) {
  const { listingId, otherUserId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  if (otherUserId === user.id) notFound()

  const [{ data: listing }, { data: otherUser }, { data: messages }, { data: offers }] = await Promise.all([
    supabase.from('listings').select('id, title, photos, seller_id, status').eq('id', listingId).single(),
    supabase.from('profiles').select('id, name, avatar_url').eq('id', otherUserId).single(),
    supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .eq('listing_id', listingId)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: MessageRow[] | null }>,
    supabase
      .from('offers')
      .select('id, buyer_id, seller_id, original_price, offered_price, proposed_by, status, round, parent_offer_id, expires_at, accepted_expires_at, created_at')
      .eq('listing_id', listingId)
      .or(`and(buyer_id.eq.${user.id},seller_id.eq.${otherUserId}),and(buyer_id.eq.${otherUserId},seller_id.eq.${user.id})`)
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: OfferRow[] | null }>,
  ])

  if (!listing) notFound()
  if (!otherUser) notFound()

  // Una compradora solo puede tener hilo con la vendedora de esta prenda.
  if (user.id !== listing.seller_id && otherUserId !== listing.seller_id) notFound()

  const messageList = messages ?? []
  const offerList = offers ?? []

  const timeline: TimelineItem[] = [
    ...messageList.map((m): TimelineItem => ({ type: 'message', createdAt: m.created_at, data: m })),
    ...offerList.map((o): TimelineItem => ({ type: 'offer', createdAt: o.created_at, data: o })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <ThreadRefresher listingId={listingId} otherUserId={otherUserId} />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-6">
          <Link href="/dashboard/messages" className="hover:text-black">Mensajes</Link>
          {' · '}
          <span>{otherUser.name}</span>
        </p>

        <div className="bg-white flex flex-col" style={{ minHeight: '60vh' }}>
          {/* Encabezado con la prenda */}
          <Link href={`/listings/${listingId}`} className="flex items-center gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition">
            <div className="w-10 h-12 bg-gray-100 relative flex-shrink-0 overflow-hidden">
              {listing.photos?.[0] ? (
                <Image src={listing.photos[0]} alt={listing.title} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">Sin foto</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{listing.title}</p>
              <p className="text-xs text-gray-400">Conversación con {otherUser.name}</p>
            </div>
          </Link>

          {/* Línea de tiempo: mensajes y ofertas mezclados por fecha */}
          <div className="flex-1 p-4 space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">
                Todavía no hay mensajes — escribe el primero o hacé una oferta desde la prenda.
              </p>
            ) : (
              timeline.map(item => {
                if (item.type === 'message') {
                  const m = item.data
                  const fromMe = m.sender_id === user.id
                  return (
                    <div key={`m-${m.id}`} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 text-sm ${
                        fromMe ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
                      }`}>
                        <p className="whitespace-pre-line">{m.content}</p>
                        <p className={`text-[9px] mt-1 ${fromMe ? 'text-gray-300' : 'text-gray-400'}`}>
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                }

                const o = item.data
                const role: 'buyer' | 'seller' = o.buyer_id === user.id ? 'buyer' : 'seller'
                const isLatest = !offerList.some(other => other.parent_offer_id === o.id)
                const myTurn = isLatest && o.status === 'pending' && o.proposed_by !== role
                const status = OFFER_STATUS_CONFIG[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-500' }
                const proposedByMe = o.proposed_by === role

                return (
                  <div key={`o-${o.id}`} className={`flex ${proposedByMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] border border-gray-200 bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm">
                          <span className="line-through text-gray-300 mr-1.5">${o.original_price.toLocaleString('es-CL')}</span>
                          <span className="font-semibold">${o.offered_price.toLocaleString('es-CL')}</span>
                        </p>
                        <span className={`text-[9px] tracking-widest uppercase px-1.5 py-0.5 whitespace-nowrap ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400">
                        {proposedByMe ? 'Ofertaste tú' : `Ofertó ${otherUser.name}`} · Ronda {o.round}/{OFFER_MAX_ROUNDS} · {formatTime(o.created_at)}
                      </p>

                      {isLatest && o.status === 'pending' && !myTurn && (
                        <p className="text-[10px] text-gray-400 mt-1.5">Esperando respuesta — vence el {formatTime(o.expires_at)}</p>
                      )}

                      {myTurn && (
                        <OfferResponseActions
                          offerId={o.id}
                          minPrice={minOfferPrice(o.original_price)}
                          maxPrice={o.original_price - 1}
                          canCounter={o.round < OFFER_MAX_ROUNDS}
                        />
                      )}

                      {isLatest && o.status === 'accepted' && role === 'buyer' && listing.status === 'active' && (
                        <div className="mt-1.5">
                          <Link
                            href={`/listings/${listingId}/checkout`}
                            className="inline-block text-[10px] tracking-widest uppercase bg-[#7fab87] text-white px-3 py-1.5 hover:bg-[#6f9678] transition"
                          >
                            Comprar al precio pactado
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Responder */}
          <div className="p-4">
            <MessageComposer listingId={listingId} receiverId={otherUserId} />
            <p className="text-[9px] text-gray-300 text-center mt-2">
              No compartas tu teléfono, dirección ni datos de pago — Bdress ya se encarga de eso en la compra.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
