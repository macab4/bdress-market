'use client'

import { Check } from 'lucide-react'
import { useSelection } from './SelectionProvider'

// Vive junto a FavoriteButton en cada tarjeta de la grilla — mismo patrón de
// círculo flotante, pero para juntar varias prendas y compartirlas como
// carrusel de Instagram en un solo paso (ver SelectionProvider).
export default function SelectToggle({ listingId, buttonClassName = '' }: { listingId: string; buttonClassName?: string }) {
  const { selectedIds, toggle } = useSelection()
  const selected = selectedIds.has(listingId)

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(listingId) }}
      aria-label={selected ? 'Quitar del carrusel a compartir' : 'Agregar al carrusel a compartir'}
      aria-pressed={selected}
      className={`w-7 h-7 rounded-full flex items-center justify-center border transition ${
        selected ? 'bg-[#7fab87] border-[#7fab87]' : 'bg-white/90 border-transparent hover:bg-white'
      } ${buttonClassName}`}
    >
      {selected && <Check size={14} className="text-white" />}
    </button>
  )
}
