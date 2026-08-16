'use client'

import { useState } from 'react'

// Mismo patrón simple de Web Share API que ya usa ShareButton.tsx (compartir
// una prenda) — acá no hace falta la complejidad de generar/adjuntar una
// imagen, así que no se reutiliza ese componente completo, solo el mismo
// enfoque: navigator.share si existe, si no, copiar al portapapeles.
export default function ReferralInviteCard({ link, rewardAmount }: { link: string; rewardAmount: number }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Bdress Market',
          text: `Únete a Bdress Market y vende tu ropa usada — usa mi link de invitación`,
          url: link,
        })
      } catch {
        // La usuaria canceló el share nativo — no es un error a mostrar.
      }
      return
    }
    await handleCopy()
  }

  return (
    <div className="bg-white p-6 space-y-4">
      <p className="text-sm text-gray-600">
        Invita a una amiga a vender en Bdress Market y gana{' '}
        <strong className="text-black">${rewardAmount.toLocaleString('es-CL')} de crédito</strong>{' '}
        cuando publique su primera prenda.
      </p>

      <div>
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Tu link de invitación</p>
        <div className="bg-gray-50 px-3 py-2.5 text-sm text-gray-700 break-all">{link}</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 border border-gray-200 text-xs tracking-widest uppercase py-3 hover:border-gray-400 transition"
        >
          {copied ? 'Copiado ✓' : 'Copiar link'}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition"
        >
          Compartir
        </button>
      </div>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        Recibes ${rewardAmount.toLocaleString('es-CL')} de crédito para comprar en Bdress Market. Este crédito es
        promocional y no puede transferirse ni retirarse en dinero.
      </p>
    </div>
  )
}
