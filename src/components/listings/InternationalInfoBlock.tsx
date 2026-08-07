import {
  INTERNATIONAL_AVAILABILITY_MESSAGE, internationalDeliveryEstimateMessage,
  INTERNATIONAL_HOW_IT_WORKS_TITLE, INTERNATIONAL_HOW_IT_WORKS_STEPS, INTERNATIONAL_AVAILABILITY_WARNING,
} from '@/lib/international/content'

// Bloque informativo de "Selección internacional" en la ficha de producto —
// mismo sistema visual de la ficha (cards blancas, texto gris, acento
// verde Bdress), sin alertas agresivas.
export default function InternationalInfoBlock({
  leadTimeMinDays, leadTimeMaxDays,
}: {
  leadTimeMinDays?: number | null
  leadTimeMaxDays?: number | null
}) {
  return (
    <div className="space-y-3">
      <div className="bg-[#7fab87]/10 p-4 space-y-2">
        <p className="text-xs text-gray-700 leading-relaxed">{INTERNATIONAL_AVAILABILITY_MESSAGE}</p>
        <p className="text-xs font-medium text-[#5a7a55]">{internationalDeliveryEstimateMessage(leadTimeMinDays, leadTimeMaxDays)}</p>
      </div>

      <details className="bg-white p-4 group">
        <summary className="text-xs tracking-widest uppercase text-gray-600 cursor-pointer select-none">
          {INTERNATIONAL_HOW_IT_WORKS_TITLE}
        </summary>
        <ol className="mt-3 space-y-1.5 text-xs text-gray-600 list-decimal list-inside">
          {INTERNATIONAL_HOW_IT_WORKS_STEPS.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </details>

      <p className="text-[11px] text-gray-400 leading-relaxed px-1">{INTERNATIONAL_AVAILABILITY_WARNING}</p>
    </div>
  )
}
