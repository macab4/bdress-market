'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  listingId: string
  listingTitle: string
}

// Para cuando la vendedora vendió la prenda por fuera de B-Dress (en
// persona, otra plataforma, etc.) y quiere reflejarlo acá. La venta hecha
// por B-Dress ya marca "vendido" sola al confirmarse el pago — esto es
// manual y aparte, ver api/listings/[id]/status.
export default function MarkSoldButton({ listingId, listingTitle }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function markSold() {
    if (!confirm(`¿Marcar "${listingTitle}" como vendida? Ya no va a estar disponible para comprar en B-Dress.`)) return
    setLoading(true)
    const res = await fetch(`/api/listings/${listingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sold' }),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'No se pudo actualizar la prenda.' }))
      alert(error)
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <button
      onClick={markSold}
      disabled={loading}
      className="block w-full text-center border border-gray-300 text-gray-700 text-xs tracking-widest uppercase py-4 hover:border-[#7fab87] hover:text-[#7fab87] transition disabled:opacity-50"
    >
      {loading ? '...' : 'Marcar como vendido'}
    </button>
  )
}
