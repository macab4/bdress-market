import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getConversations } from '@/lib/messages'
import InboxRefresher from '@/components/messages/InboxRefresher'
import ConversationList from '@/components/messages/ConversationList'

export default async function MessagesInboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const conversations = await getConversations(supabase, user.id)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <InboxRefresher />
      <div className="md:max-w-5xl md:mx-auto md:flex md:gap-4 md:px-4 md:py-10">
        <ConversationList conversations={conversations} />
        <div className="hidden md:flex flex-1 bg-white items-center justify-center md:h-[calc(100dvh-5rem)]">
          <p className="text-sm text-gray-400">Elegí una conversación para ver los mensajes.</p>
        </div>
      </div>
    </div>
  )
}
