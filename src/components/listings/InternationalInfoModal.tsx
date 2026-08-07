'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Globe2 } from 'lucide-react'
import {
  INTERNATIONAL_BADGE_LABEL, INTERNATIONAL_AVAILABILITY_MESSAGE, internationalDeliveryEstimateMessage,
  INTERNATIONAL_HOW_IT_WORKS_TITLE, INTERNATIONAL_HOW_IT_WORKS_STEPS, INTERNATIONAL_HOW_IT_WORKS_CLOSING,
} from '@/lib/international/content'

// De cara a la clienta esto se presenta simple, tipo "envío internacional
// gestionado por nosotras" — sin explicar que la prenda se compra después
// en otra plataforma ni que su disponibilidad se confirma manualmente (esa
// operación sigue igual del lado admin, ver src/lib/international/status.ts).
// Mismo patrón de modal que BuyerProtectionModal.tsx.
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
      {/* Trigger visible en la ficha: ícono + nombre, plazo destacado, y un
          link a "¿Cómo funciona?" que abre el detalle — nada de esto ocupa
          espacio permanente más allá de dos líneas cortas. */}
      <div className="bg-[#7fab87]/10 px-4 py-3 space-y-1">
        <p className="flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-[#5a7a55]">
          <Globe2 size={14} />
          {INTERNATIONAL_BADGE_LABEL}
        </p>
        <p className="text-sm font-medium text-[#5a7a55]">
          {internationalDeliveryEstimateMessage(leadTimeMinDays, leadTimeMaxDays)}
        </p>
        <button
          type="button"
          onClick={(e) => { stop(e); setOpen(true) }}
          className="text-xs text-[#5a7a55] underline underline-offset-2 hover:text-black"
        >
          ¿Cómo funciona?
        </button>
      </div>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => { stop(e); setOpen(false) }}
        >
          <div
            className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-white p-6 sm:rounded"
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

            <p className="text-sm text-gray-600 mb-2">{INTERNATIONAL_AVAILABILITY_MESSAGE}</p>
            <p className="text-sm font-medium text-[#5a7a55] mb-6">
              {internationalDeliveryEstimateMessage(leadTimeMinDays, leadTimeMaxDays)}
            </p>

            <div>
              <h3 className="text-xs tracking-widest uppercase text-gray-400 mb-2">{INTERNATIONAL_HOW_IT_WORKS_TITLE}</h3>
              <ol className="space-y-1.5 text-sm text-gray-600 list-decimal list-inside">
                {INTERNATIONAL_HOW_IT_WORKS_STEPS.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mt-4">{INTERNATIONAL_HOW_IT_WORKS_CLOSING}</p>

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
