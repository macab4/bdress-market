'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  otherUserId: string
}

// Marca el hilo como leído y refresca periódicamente — este chat no usa
// websockets, así que un poll simple es suficiente para sentirse al día.
export default function ThreadRefresher({ listingId, otherUserId }: Props) {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function tick() {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, other_user_id: otherUserId }),
      })
      if (!cancelled) router.refresh()
    }

    tick()
    const interval = setInterval(tick, 6000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [listingId, otherUserId, router])

  return null
}
