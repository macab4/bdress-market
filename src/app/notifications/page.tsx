import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Notification } from '@/types'
import { REFERRAL_REWARD_AMOUNT } from '@/lib/catalog'

type NotificationWithRelations = Notification & {
  actor: { name: string } | null
  listing: { title: string; photos: string[] } | null
}

const ACTION_TEXT: Record<Notification['type'], string> = {
  new_listing: 'publicó una prenda nueva',
  offer_received: 'te hizo una oferta por',
  offer_accepted: 'aceptó tu oferta por',
  offer_rejected: 'rechazó tu oferta por',
  offer_countered: 'te hizo una contraoferta por',
  new_message: 'te escribió por',
  referral_bonus: `publicó su primera prenda — ganaste $${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')} de Crédito B-Dress 💚`,
  sale_paid: 'te compró',
  label_requested: 'pidió la etiqueta de envío de',
  withdrawal_requested: 'pidió un retiro de su Saldo B-Dress 🏦',
}

// Tipos que deben llevar a la conversación real (listing + la contraparte,
// que en estos casos siempre es actor_id) en vez de a la ficha del
// producto — ver auditoría de deep links.
const CONVERSATION_TYPES: Notification['type'][] = ['offer_received', 'offer_accepted', 'offer_rejected', 'offer_countered', 'new_message']

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(name), listing:listings(title, photos)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as unknown as { data: NotificationWithRelations[] | null }

  const list = notifications ?? []
  const unreadIds = list.filter(n => !n.read_at).map(n => n.id)
  if (unreadIds.length > 0) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds)
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8">Notificaciones</h1>

        {list.length > 0 ? (
          <div className="space-y-2">
            {list.map(n => (
              <Link
                key={n.id}
                href={
                  n.type === 'referral_bonus' ? '/dashboard/wallet'
                    : n.type === 'sale_paid' ? '/dashboard/sales'
                    : n.type === 'label_requested' ? '/admin'
                    : n.type === 'withdrawal_requested' ? '/admin/wallet/withdrawals'
                    // Ofertas y mensajes van a la conversación real, no a la
                    // ficha — actor_id es siempre la contraparte correcta
                    // desde la perspectiva de quien recibe la notificación.
                    : CONVERSATION_TYPES.includes(n.type) && n.listing_id ? `/dashboard/messages/${n.listing_id}/${n.actor_id}`
                    : n.listing_id ? `/listings/${n.listing_id}` : '#'
                }
                className="flex items-center gap-3 bg-white p-4 hover:bg-gray-50 transition"
              >
                <div className="w-12 h-16 bg-gray-100 flex-shrink-0 overflow-hidden relative">
                  {n.type === 'referral_bonus' ? (
                    <div className="w-full h-full flex items-center justify-center bg-[#7fab87]/10 text-lg">💚</div>
                  ) : n.type === 'withdrawal_requested' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-lg">🏦</div>
                  ) : n.listing?.photos?.[0] ? (
                    <Image src={n.listing.photos[0]} alt={n.listing.title} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[9px]">Sin foto</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{n.actor?.name ?? 'Alguien'}</span>{' '}
                    {ACTION_TEXT[n.type]}
                    {n.listing?.title && <>: <span className="font-medium">{n.listing.title}</span></>}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                {!n.read_at && (
                  <span className="w-2 h-2 rounded-full bg-[#7fab87] flex-shrink-0" />
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white">
            <p className="text-gray-400 text-sm mb-2">Todavía no tienes notificaciones.</p>
            <p className="text-gray-400 text-xs">
              Cuando tengas actividad en tus compras, ventas, ofertas o mensajes, aparecerá aquí.
            </p>
            <p className="text-gray-400 text-xs mt-1">
              También puedes seguir vendedoras para enterarte cuando publiquen algo nuevo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
