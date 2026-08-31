'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VacationModeToggle({ initialVacationMode }: { initialVacationMode: boolean }) {
  const [vacationMode, setVacationMode] = useState(initialVacationMode)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function toggle() {
    const next = !vacationMode
    const confirmMsg = next
      ? '¿Activar modo vacaciones? Tus prendas dejan de verse en el catálogo y nadie podrá comprarlas hasta que lo desactives. Las ventas que ya tengas en curso siguen su proceso normal.'
      : '¿Desactivar modo vacaciones? Tus prendas vuelven a verse y a poder comprarse normalmente.'
    if (!confirm(confirmMsg)) return

    setLoading(true)
    const res = await fetch('/api/dashboard/vacation-mode', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vacation_mode: next }),
    })
    if (res.ok) {
      setVacationMode(next)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className={`p-4 flex items-center justify-between gap-4 mb-6 ${vacationMode ? 'bg-amber-50' : 'bg-white'}`}>
      <div>
        <p className="text-sm font-medium">Modo vacaciones</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {vacationMode
            ? 'Activo — tus prendas están ocultas y no se pueden comprar.'
            : 'Pausa toda tu tienda de una vez, sin tener que pausar prenda por prenda.'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`text-[10px] tracking-widest uppercase px-4 py-2 flex-shrink-0 transition disabled:opacity-50 ${
          vacationMode ? 'bg-black text-white hover:bg-gray-800' : 'border border-gray-300 text-gray-700 hover:border-[#7fab87] hover:text-[#7fab87]'
        }`}
      >
        {loading ? '...' : vacationMode ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  )
}
