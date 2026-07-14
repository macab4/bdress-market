import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireAdminUser } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminNav from '@/components/admin/AdminNav'
import SuspendUserButton from '@/components/admin/SuspendUserButton'
import { OFFER_STATUS_CONFIG, OFFER_MAX_ROUNDS } from '@/lib/catalog'
import { REPEAT_OFFENDER_THRESHOLD } from '@/lib/messageModeration'

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
  created_at: string
}

type FlagRow = {
  id: string
  sender_id: string
  content: string
  reason: string
  created_at: string
}

type TimelineItem =
  | { type: 'message'; createdAt: string; data: MessageRow }
  | { type: 'offer'; createdAt: string; data: OfferRow }

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function AdminMessageThreadPage({
  params,
}: {
  params: Promise<{ listingId: string; buyerId: string }>
}) {
  await requireAdminUser()
  const { listingId, buyerId } = await params
  const admin = createAdminClient()

  const { data: listing } = await admin.from('listings').select('id, title, photos, seller_id, status').eq('id', listingId).single()
  if (!listing) notFound()
  const sellerId = listing.seller_id
  if (buyerId === sellerId) notFound()

  const [
    { data: buyerAuth },
    { data: sellerAuth },
    { data: buyerProfile },
    { data: sellerProfile },
    { data: messages },
    { data: offers },
    { data: flags },
    { count: buyerTotalFlags },
    { count: sellerTotalFlags },
  ] = await Promise.all([
    admin.auth.admin.getUserById(buyerId),
    admin.auth.admin.getUserById(sellerId),
    admin.from('profiles').select('name').eq('id', buyerId).single(),
    admin.from('profiles').select('name').eq('id', sellerId).single(),
    admin
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .eq('listing_id', listingId)
      .or(`and(sender_id.eq.${buyerId},receiver_id.eq.${sellerId}),and(sender_id.eq.${sellerId},receiver_id.eq.${buyerId})`)
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: MessageRow[] | null }>,
    admin
      .from('offers')
      .select('id, buyer_id, seller_id, original_price, offered_price, proposed_by, status, round, parent_offer_id, created_at')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: true }) as unknown as Promise<{ data: OfferRow[] | null }>,
    admin
      .from('message_flags')
      .select('id, sender_id, content, reason, created_at')
      .eq('listing_id', listingId)
      .or(`sender_id.eq.${buyerId},sender_id.eq.${sellerId}`)
      .order('created_at', { ascending: false }) as unknown as Promise<{ data: FlagRow[] | null }>,
    admin.from('message_flags').select('*', { count: 'exact', head: true }).eq('sender_id', buyerId),
    admin.from('message_flags').select('*', { count: 'exact', head: true }).eq('sender_id', sellerId),
  ])

  if (!buyerAuth?.user || !sellerAuth?.user) notFound()

  const buyerBanned = !!buyerAuth.user.banned_until && new Date(buyerAuth.user.banned_until) > new Date()
  const sellerBanned = !!sellerAuth.user.banned_until && new Date(sellerAuth.user.banned_until) > new Date()

  const messageList = messages ?? []
  const offerList = offers ?? []
  const flagList = flags ?? []

  const timeline: TimelineItem[] = [
    ...messageList.map((m): TimelineItem => ({ type: 'message', createdAt: m.created_at, data: m })),
    ...offerList.map((o): TimelineItem => ({ type: 'offer', createdAt: o.created_at, data: o })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-6">Panel de administración</h1>
        <AdminNav active="/admin/messages" />

        <Link href="/admin/messages" className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black mb-6 inline-block">
          ← Volver a mensajes
        </Link>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="bg-white p-4 flex-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-gray-400">Compradora</p>
              <p className="text-sm font-medium truncate">
                {buyerProfile?.name ?? '—'}
                {!!buyerTotalFlags && buyerTotalFlags > 0 && (
                  <span className={`ml-2 text-[9px] tracking-widest uppercase px-1.5 py-0.5 align-middle ${
                    buyerTotalFlags >= REPEAT_OFFENDER_THRESHOLD ? 'bg-red-100 text-red-700 font-semibold' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {buyerTotalFlags} alertas
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 truncate">{buyerAuth.user.email}</p>
            </div>
            <SuspendUserButton userId={buyerId} banned={buyerBanned} />
          </div>
          <div className="bg-white p-4 flex-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-gray-400">Vendedora</p>
              <p className="text-sm font-medium truncate">
                {sellerProfile?.name ?? '—'}
                {!!sellerTotalFlags && sellerTotalFlags > 0 && (
                  <span className={`ml-2 text-[9px] tracking-widest uppercase px-1.5 py-0.5 align-middle ${
                    sellerTotalFlags >= REPEAT_OFFENDER_THRESHOLD ? 'bg-red-100 text-red-700 font-semibold' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {sellerTotalFlags} alertas
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400 truncate">{sellerAuth.user.email}</p>
            </div>
            <SuspendUserButton userId={sellerId} banned={sellerBanned} />
          </div>
        </div>

        {flagList.length > 0 && (
          <div className="bg-red-50 p-4 mb-6">
            <p className="text-[10px] tracking-widest uppercase text-red-600 mb-2">
              {flagList.length} intento{flagList.length > 1 ? 's' : ''} bloqueado{flagList.length > 1 ? 's' : ''} en esta conversación
            </p>
            <div className="space-y-1.5">
              {flagList.map(f => (
                <p key={f.id} className="text-xs text-red-700">
                  <span className="font-medium">{f.sender_id === buyerId ? 'Compradora' : 'Vendedora'}</span>
                  {' '}— {f.reason}: &quot;{f.content}&quot;
                  <span className="text-red-400"> · {formatTime(f.created_at)}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white flex flex-col">
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
              <p className="text-xs text-gray-400">Ver publicación</p>
            </div>
          </Link>

          <div className="p-4 space-y-3">
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Todavía no hay mensajes ni ofertas en esta conversación.</p>
            ) : (
              timeline.map(item => {
                if (item.type === 'message') {
                  const m = item.data
                  const fromBuyer = m.sender_id === buyerId
                  return (
                    <div key={`m-${m.id}`} className={`flex ${fromBuyer ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] px-3 py-2 text-sm ${fromBuyer ? 'bg-gray-100 text-gray-800' : 'bg-black text-white'}`}>
                        <p className="whitespace-pre-line">{m.content}</p>
                        <p className={`text-[9px] mt-1 ${fromBuyer ? 'text-gray-400' : 'text-gray-300'}`}>
                          {fromBuyer ? 'Compradora' : 'Vendedora'} · {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                }

                const o = item.data
                const status = OFFER_STATUS_CONFIG[o.status] ?? { label: o.status, color: 'bg-gray-100 text-gray-500' }
                const proposedByBuyer = o.proposed_by === 'buyer'

                return (
                  <div key={`o-${o.id}`} className={`flex ${proposedByBuyer ? 'justify-start' : 'justify-end'}`}>
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
                        {proposedByBuyer ? 'Ofertó la compradora' : 'Ofertó la vendedora'} · Ronda {o.round}/{OFFER_MAX_ROUNDS} · {formatTime(o.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
