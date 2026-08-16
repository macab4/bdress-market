'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { REFERRAL_STATUS_CONFIG } from '@/lib/catalog'
import { ReferralStatus } from '@/types'

// Mismo patrón simple de Web Share API que ya usa ShareButton.tsx (compartir
// una prenda) — acá no hace falta la complejidad de generar/adjuntar una
// imagen, así que no se reutiliza ese componente completo, solo el mismo
// enfoque: navigator.share si existe, si no, copiar al portapapeles.
//
// Este componente concentra TODO el cuerpo interactivo de la página (link,
// botones, cómo funciona, tus invitaciones) en vez de estar separado de la
// lista de abajo — así el botón "Invitar ahora" del estado vacío puede
// llamar exactamente a la misma handleShare que el botón principal, sin
// duplicar la lógica de compartir en dos componentes distintos.
const STEPS = ['Comparte tu link', 'Tu amiga se registra', 'Publica su primera prenda']

interface ReferralInviteCardProps {
  link: string
  rewardAmount: number
  monthlyLimit: number
  rewardedThisMonth: number
  referrals: { id: string; name: string | null; status: ReferralStatus }[]
}

export default function ReferralInviteCard({ link, rewardAmount, monthlyLimit, rewardedThisMonth, referrals }: ReferralInviteCardProps) {
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

  // El selector nativo (handleShare) no siempre incluye WhatsApp — en Mac
  // de escritorio, WhatsApp Desktop no se registra como destino ahí aunque
  // esté instalado (limitación del sistema, no nuestra). wa.me sí funciona
  // en cualquier dispositivo: abre la app si está instalada, o
  // web.whatsapp.com si no.
  function handleWhatsApp() {
    const text = `Únete a Bdress Market y vende tu ropa usada — usa mi link de invitación: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 sm:p-8 space-y-6">
        <p className="text-sm text-gray-600 leading-relaxed">
          Invita a una amiga a vender en Bdress Market. Cuando publique su primera prenda, recibes{' '}
          <strong className="text-[#5a7a55]">${rewardAmount.toLocaleString('es-CL')} de crédito</strong> para comprar.
        </p>

        <div>
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Tu link de invitación</p>
          <div className="bg-gray-50 px-3 py-2.5 text-sm text-gray-700 break-all">{link}</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
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
            Invitar a una amiga
          </button>
        </div>

        <button
          type="button"
          onClick={handleWhatsApp}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition mx-auto sm:mx-0"
        >
          <MessageCircle size={14} />
          Enviar por WhatsApp
        </button>

        {/* Cómo funciona — horizontal en desktop, apilado en mobile */}
        <div className="border-t border-gray-100 pt-6">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">¿Cómo funciona?</p>
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center sm:gap-1.5">
                <span className="text-base font-light text-[#7fab87] sm:text-xl">{i + 1}</span>
                <p className="text-xs text-gray-600 sm:leading-tight">{step}</p>
              </div>
            ))}
            <div className="sm:flex-1 bg-[#7fab87]/10 py-3 px-3 flex items-center justify-center">
              <p className="text-xs font-medium tracking-wide text-[#5a7a55] uppercase text-center">
                Tú ganas ${rewardAmount.toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          Crédito promocional válido solo para compras en Bdress Market. No transferible ni retirable en dinero.
        </p>
      </div>

      <section className="bg-white p-6 sm:p-8">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1">Tus invitaciones</p>
        <p className="text-sm mb-5">
          <span className="font-medium text-[#5a7a55]">{rewardedThisMonth}</span> de {monthlyLimit} invitaciones premiadas este mes
        </p>

        {referrals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-1">Aún no has invitado a nadie.</p>
            <p className="text-xs text-gray-400 mb-5">
              Comparte tu link y gana ${rewardAmount.toLocaleString('es-CL')} cuando una amiga publique su primera prenda.
            </p>
            <button
              type="button"
              onClick={handleShare}
              className="bg-[#7fab87] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#6f9678] transition"
            >
              Invitar ahora
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {referrals.map(referral => {
              const status = REFERRAL_STATUS_CONFIG[referral.status] ?? { label: referral.status, color: 'bg-gray-100 text-gray-500', detail: '' }
              return (
                <div key={referral.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{referral.name || 'Usuaria invitada'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{status.detail}</p>
                  </div>
                  <span className={`text-[9px] tracking-widest uppercase px-2 py-0.5 whitespace-nowrap flex-shrink-0 ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
