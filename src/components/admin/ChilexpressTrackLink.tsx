'use client'

import { useState } from 'react'

const CHILEXPRESS_TRACKING_URL = 'https://centrodeayuda.chilexpress.cl/home'

// No hay forma confirmada de precargar el N.º de OT en el buscador de
// Chilexpress vía URL, así que en vez de eso copiamos el número al
// portapapeles al hacer click — el admin solo tiene que pegarlo ahí.
export default function ChilexpressTrackLink({ trackingNumber }: { trackingNumber: string }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(trackingNumber)
      setCopied(true)
    } catch {
      // Sin permiso de portapapeles — igual se abre el link, solo no se copia.
    }
  }

  return (
    <a
      href={CHILEXPRESS_TRACKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-block text-[10px] tracking-widest uppercase text-[#7fab87] hover:underline pt-1"
    >
      {copied ? 'N.º copiado — pégalo en "Ingresa tu N.º de OT"' : 'Rastrear en Chilexpress'}
    </a>
  )
}
