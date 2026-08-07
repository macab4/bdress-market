'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// "Comprobar disponibilidad" (sección 2 del encargo) — en esta versión no
// consulta Vinted automáticamente, solo registra lo que la admin confirmó
// a mano tras revisar la publicación original.
export default function InternationalAvailabilityCheck({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function check(result: 'available' | 'unavailable' | 'later') {
    if (result === 'unavailable' && !confirm('¿Marcar esta prenda como no disponible en la plataforma de origen?')) return
    setLoading(true)
    await fetch(`/api/admin/international/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability_check: result }),
    })
    setOpen(false)
    router.refresh()
    setLoading(false)
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black flex-shrink-0">
        Comprobar disponibilidad
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button onClick={() => check('available')} disabled={loading} className="text-[10px] tracking-widest uppercase text-[#5a7a55] hover:text-black disabled:opacity-50">
        Sigue disponible
      </button>
      <button onClick={() => check('unavailable')} disabled={loading} className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 disabled:opacity-50">
        Ya no disponible
      </button>
      <button onClick={() => check('later')} disabled={loading} className="text-[10px] tracking-widest uppercase text-gray-400 hover:text-black disabled:opacity-50">
        Revisar después
      </button>
      <button onClick={() => setOpen(false)} className="text-[10px] text-gray-300 hover:text-black">✕</button>
    </div>
  )
}
