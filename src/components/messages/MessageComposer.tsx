'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { moderateMessage, MODERATION_MESSAGE } from '@/lib/messageModeration'

interface Props {
  listingId: string
  receiverId: string
}

export default function MessageComposer({ listingId, receiverId }: Props) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) return

    // Chequeo rápido en el cliente para no ir y volver al servidor — el
    // servidor igual vuelve a validar, así que esto es solo para feedback
    // instantáneo, no la barrera de seguridad real.
    if (moderateMessage(trimmed).blocked) {
      setError(MODERATION_MESSAGE)
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId, receiver_id: receiverId, content: trimmed }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Error al enviar el mensaje')
      setLoading(false)
      return
    }
    setContent('')
    setLoading(false)
    router.refresh()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Escribe un mensaje..."
          className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-black text-white text-xs tracking-widest uppercase px-4 py-2.5 hover:bg-gray-800 transition disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
