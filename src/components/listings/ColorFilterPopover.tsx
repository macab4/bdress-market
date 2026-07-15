'use client'

import { useEffect, useRef, useState } from 'react'
import { COLORS } from '@/lib/catalog'

export default function ColorFilterPopover({ defaultValue }: { defaultValue?: string }) {
  const [selected, setSelected] = useState<string[]>(defaultValue ? defaultValue.split(',') : [])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggle(value: string) {
    setSelected(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] tracking-widest uppercase text-gray-400 mb-1">Color</label>
      <input type="hidden" name="color" value={selected.join(',')} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white flex items-center gap-2 min-w-[110px] justify-between"
      >
        <span>{selected.length === 0 ? 'Todos' : `${selected.length} color${selected.length > 1 ? 'es' : ''}`}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 shadow-lg p-4 w-72">
          <div className="grid grid-cols-4 gap-x-2 gap-y-3 max-h-72 overflow-y-auto pr-1">
            {COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => toggle(c.value)}
                className="flex flex-col items-center gap-1 group"
                aria-pressed={selected.includes(c.value)}
              >
                <span
                  className={`w-8 h-8 rounded-full border transition ${
                    selected.includes(c.value) ? 'ring-2 ring-offset-1 ring-black' : 'border-gray-200 group-hover:border-gray-400'
                  } ${c.value === 'blanco' || c.value === 'transparente' ? 'border-gray-300' : ''}`}
                  style={c.value === 'varios'
                    ? { background: 'conic-gradient(from 0deg, #C0392B, #F5A623, #F5E050, #4C9A4A, #2166B8, #6C2C8C, #C0392B)' }
                    : { backgroundColor: c.hex }}
                />
                <span className="text-[9px] text-gray-500 text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-gray-400 hover:text-black underline"
            >
              Limpiar
            </button>
            <button
              type="submit"
              onClick={() => setOpen(false)}
              className="flex-1 bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2 hover:bg-[#6f9678] transition"
            >
              Ver resultados
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
