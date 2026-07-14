import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Offer } from '@/types'
import { OFFER_STATUS_CONFIG, OFFER_MAX_ROUNDS, minOfferPrice } from '@/lib/catalog'
import OfferResponseActions from '@/components/dashboard/OfferResponseActions'

type OfferWithRelations = Offer & {
  listing: { title: string; photos: string[]; status: string } | null
  buyer: { name: string } | null
  seller: { name: string } | null
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function OffersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data } = await supabase
    .from('offers')
    .select(`
      *,
      listing:listings(title, photos, status),
      buyer:profiles!offers_buyer_id_fkey(name),
      seller:profiles!offers_seller_id_fkey(name)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false }) as { data: OfferWithRelations[] | null }

  const all = data ?? []
  // Cada hilo puede tener varias rondas encadenadas — solo la última fila
  // (la que ningún otro registro referencia como padre) refleja el estado vigente.
  const latest = all.filter(o => !all.some(other => other.parent_offer_id === o.id))

  const made = latest.filter(o => o.buyer_id === user.id)
  const received = latest.filter(o => o.seller_id === user.id)

  function renderCard(offer: OfferWithRelations, role: 'buyer' | 'seller') {
    const status = OFFER_STATUS_CONFIG[offer.status] ?? { label: offer.status, color: 'bg-gray-100 text-gray-500' }
    const photo = offer.listing?.photos?.[0]
    const counterpartyName = role === 'buyer' ? offer.seller?.name : offer.buyer?.name
    const myTurn = offer.status === 'pending' && offer.proposed_by !== role

    return (
      <div key={offer.id} className="bg-white p-5">
        <div className="flex gap-4">
          <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
            {photo ? (
              <Image src={photo} alt={offer.listing?.title ?? ''} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-medium truncate">{offer.listing?.title ?? 'Prenda'}</p>
              <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${status.color}`}>
                {status.label}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-1">
              {role === 'buyer' ? 'Vendedora' : 'Compradora'}: {counterpartyName ?? '—'} · Ronda {offer.round}/{OFFER_MAX_ROUNDS}
            </p>

            <p className="text-sm">
              <span className="line-through text-gray-300 mr-2">${offer.original_price.toLocaleString('es-CL')}</span>
              <span className="font-semibold">${offer.offered_price.toLocaleString('es-CL')}</span>
            </p>

            {offer.status === 'pending' && !myTurn && (
              <p className="text-xs text-gray-400 mt-2">
                Esperando respuesta — vence el {formatExpiry(offer.expires_at)}
              </p>
            )}

            {offer.status === 'pending' && myTurn && (
              <OfferResponseActions
                offerId={offer.id}
                minPrice={minOfferPrice(offer.original_price)}
                maxPrice={offer.original_price - 1}
                canCounter={offer.round < OFFER_MAX_ROUNDS}
              />
            )}

            {offer.status === 'accepted' && role === 'buyer' && offer.listing?.status === 'active' && (
              <div className="mt-2">
                <Link
                  href={`/listings/${offer.listing_id}/checkout`}
                  className="inline-block text-[10px] tracking-widest uppercase bg-[#5a7a55] text-white px-4 py-2 hover:bg-[#4a6647] transition"
                >
                  Comprar al precio pactado
                </Link>
                {offer.accepted_expires_at && (
                  <p className="text-[10px] text-gray-400 mt-1">Vence el {formatExpiry(offer.accepted_expires_at)}</p>
                )}
              </div>
            )}

            {offer.status === 'accepted' && role === 'seller' && (
              <p className="text-xs text-gray-400 mt-2">
                Esperando que la compradora pague
                {offer.accepted_expires_at && ` — vence el ${formatExpiry(offer.accepted_expires_at)}`}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Mis ofertas</h1>

        <section className="mb-10">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Ofertas que hice {made.length > 0 && `(${made.length})`}
          </p>
          {made.length > 0 ? (
            <div className="space-y-4">{made.map(o => renderCard(o, 'buyer'))}</div>
          ) : (
            <div className="bg-white p-8 text-center text-sm text-gray-400">Todavía no has hecho ninguna oferta.</div>
          )}
        </section>

        <section>
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">
            Ofertas que recibí {received.length > 0 && `(${received.length})`}
          </p>
          {received.length > 0 ? (
            <div className="space-y-4">{received.map(o => renderCard(o, 'seller'))}</div>
          ) : (
            <div className="bg-white p-8 text-center text-sm text-gray-400">Todavía no has recibido ninguna oferta.</div>
          )}
        </section>
      </div>
    </div>
  )
}
