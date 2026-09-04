import Link from 'next/link'
import Image from 'next/image'
import type { Conversation } from '@/lib/messages'

// Se usa tanto en la bandeja (/dashboard/messages, sin selección) como en el
// hilo individual (con selectedKey) — en desktop queda siempre visible al
// lado de la conversación abierta; en mobile se oculta cuando hay un hilo
// abierto (hiddenOnMobile) para que el chat ocupe toda la pantalla.
export default function ConversationList({
  conversations,
  selectedKey,
  hiddenOnMobile,
}: {
  conversations: Conversation[]
  selectedKey?: string
  hiddenOnMobile?: boolean
}) {
  return (
    <div className={`w-full md:w-80 md:flex-shrink-0 bg-white md:border-r md:border-gray-100 ${hiddenOnMobile ? 'hidden md:block' : ''}`}>
      <h1 className="text-xl font-light tracking-widest uppercase p-4 md:p-6 md:pb-4">Mensajes</h1>

      {conversations.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-gray-400">Todavía no tienes conversaciones.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 md:h-[calc(100dvh-9rem)] md:overflow-y-auto">
          {conversations.map(c => {
            const key = `${c.listingId}:${c.otherId}`
            const selected = key === selectedKey
            return (
              <Link
                key={key}
                href={`/dashboard/messages/${c.listingId}/${c.otherId}`}
                className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition ${selected ? 'bg-gray-50' : ''}`}
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
                      {new Date(c.lastCreatedAt).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'short' })}
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
            )
          })}
        </div>
      )}
    </div>
  )
}
