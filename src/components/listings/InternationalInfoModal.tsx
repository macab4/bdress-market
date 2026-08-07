'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Globe2 } from 'lucide-react'
import {
  INTERNATIONAL_BADGE_LABEL, INTERNATIONAL_AVAILABILITY_MESSAGE, internationalDeliveryEstimateMessage,
  INTERNATIONAL_HOW_IT_WORKS_TITLE, INTERNATIONAL_HOW_IT_WORKS_STEPS, INTERNATIONAL_AVAILABILITY_WARNING,
} from '@/lib/international/content'

// Reemplaza el bloque siempre-visible que explicaba la mecánica interna
// (compramos, confirmamos, podría venderse) directo en la ficha — ahora es
// un botón que abre el detalle, mismo patrón que BuyerProtectionModal.tsx.
// El checkbox de aceptación obligatoria del checkout no cambia: ese sigue
// mostrando el texto completo siempre, porque ahí es donde queda el
// consentimiento registrado.
export default function InternationalInfoModal({
  leadTimeMinDays, leadTimeMaxDays,
}: {
  leadTimeMinDays?: number | null
  leadTimeMaxDays?: number | null
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setOpen(true) }}
        className="inline-flex items-center gap-1.5 bg-[#7fab87]/10 text-[#5a7a55] text-[11px] tracking-widest uppercase px-3 py-2 hover:bg-[#7fab87]/20 transition"
      >
        <Globe2 size={13} />
        {INTERNATIONAL_BADGE_LABEL}
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => { stop(e); setOpen(false) }}
        >
          <div
            className="relative w-full sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white p-6 sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false) }}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#7fab87]/10 flex items-center justify-center mb-4">
                <Globe2 size={24} className="text-[#5a7a55]" />
              </div>
              <h2 className="text-base font-medium">{INTERNATIONAL_BADGE_LABEL}</h2>
            </div>

            <p className="text-sm text-gray-600 mb-1">{INTERNATIONAL_AVAILABILITY_MESSAGE}</p>
            <p className="text-sm font-medium text-[#5a7a55] mb-6">
              {internationalDeliveryEstimateMessage(leadTimeMinDays, leadTimeMaxDays)}
            </p>

            <div>
              <h3 className="text-xs tracking-widest uppercase text-gray-400 mb-2">{INTERNATIONAL_HOW_IT_WORKS_TITLE}</h3>
              <ol className="space-y-1.5 text-sm text-gray-600 list-decimal list-inside">
                {INTERNATIONAL_HOW_IT_WORKS_STEPS.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed mt-6">{INTERNATIONAL_AVAILABILITY_WARNING}</p>

            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false) }}
              className="w-full bg-[#7fab87] text-white text-sm tracking-widest uppercase py-3 mt-6 hover:bg-[#6f9678] transition"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
