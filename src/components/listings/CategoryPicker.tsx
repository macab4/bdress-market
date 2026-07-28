'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { TAXONOMY, CategoryValue } from '@/lib/catalog'

export interface CategoryPickerValue {
  department: CategoryValue | ''
  productCategory: string
  productType: string
}

interface CategoryPickerProps {
  value: CategoryPickerValue
  onChange: (value: CategoryPickerValue) => void
  /** "filter" allows applying a department/category alone ("Ver todo" a ese nivel); "form" espera llegar al tipo. */
  mode?: 'form' | 'filter'
  triggerClassName?: string
  triggerLabel?: string
}

type MobileStep = 'department' | 'category' | 'type'

function pathLabel(value: CategoryPickerValue): string {
  const dept = TAXONOMY.find(d => d.value === value.department)
  if (!dept) return ''
  const cat = dept.productCategories.find(c => c.value === value.productCategory)
  if (!cat) return dept.label
  const type = cat.types.find(t => t.value === value.productType)
  if (!type) return `${dept.label} › ${cat.label}`
  return `${dept.label} › ${cat.label} › ${type.label}`
}

export default function CategoryPicker({ value, onChange, mode = 'form', triggerClassName, triggerLabel = 'Categoría' }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [mobileStep, setMobileStep] = useState<MobileStep>('department')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  function openPanel() {
    setMobileStep(value.department ? (value.productCategory ? 'type' : 'category') : 'department')
    setOpen(true)
  }

  const dept = TAXONOMY.find(d => d.value === value.department)
  const cat = dept?.productCategories.find(c => c.value === value.productCategory)

  // En modo filtro, elegir departamento o categoría aplica de inmediato
  // (la URL se actualiza en vivo) pero el panel se queda abierto para poder
  // seguir bajando de nivel — solo un tipo o "Ver todo" lo cierran.
  function pickDepartment(department: CategoryValue) {
    onChange({ department, productCategory: '', productType: '' })
    setMobileStep('category')
  }

  function pickCategory(productCategory: string) {
    if (!value.department) return
    onChange({ department: value.department, productCategory, productType: '' })
    setMobileStep('type')
  }

  function pickType(productType: string) {
    if (!value.department) return
    onChange({ department: value.department, productCategory: value.productCategory, productType })
    setOpen(false)
  }

  function clearAll() {
    onChange({ department: '', productCategory: '', productType: '' })
    setOpen(false)
  }

  const label = pathLabel(value) || triggerLabel

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={triggerClassName ?? 'border border-gray-200 px-3 py-2 text-sm bg-white text-left'}
      >
        {label}
      </button>

      {open && (
        <>
          {/* Desktop: panel de 3 columnas */}
          <div
            role="dialog"
            aria-label="Elegir categoría"
            className="hidden sm:block absolute z-50 top-full left-0 mt-2 w-[560px] max-w-[90vw] bg-white border border-gray-200 shadow-lg"
          >
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="max-h-80 overflow-y-auto">
                {mode === 'filter' && (
                  <button type="button" onClick={clearAll}
                    className="w-full text-left px-3 py-2 text-xs tracking-widest uppercase text-gray-400 hover:bg-gray-50">
                    Ver todo
                  </button>
                )}
                {TAXONOMY.map(d => (
                  <button key={d.value} type="button" onClick={() => pickDepartment(d.value)}
                    className={`w-full text-left px-3 py-2 text-sm ${value.department === d.value ? 'bg-[#7fab87]/10 text-[#5a7a55] font-medium' : 'hover:bg-gray-50'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!dept ? (
                  <p className="px-3 py-2 text-xs text-gray-300">Elige un departamento</p>
                ) : (
                  <>
                    {mode === 'filter' && (
                      <button type="button" onClick={() => onChange({ department: dept.value, productCategory: '', productType: '' })}
                        className="w-full text-left px-3 py-2 text-xs tracking-widest uppercase text-gray-400 hover:bg-gray-50">
                        Ver todo en {dept.label}
                      </button>
                    )}
                    {dept.productCategories.map(c => (
                      <button key={c.value} type="button" onClick={() => pickCategory(c.value)}
                        className={`w-full text-left px-3 py-2 text-sm ${value.productCategory === c.value ? 'bg-[#7fab87]/10 text-[#5a7a55] font-medium' : 'hover:bg-gray-50'}`}>
                        {c.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!cat ? (
                  <p className="px-3 py-2 text-xs text-gray-300">Elige una categoría</p>
                ) : (
                  <>
                    {mode === 'filter' && (
                      <button type="button" onClick={() => onChange({ department: value.department, productCategory: cat.value, productType: '' })}
                        className="w-full text-left px-3 py-2 text-xs tracking-widest uppercase text-gray-400 hover:bg-gray-50">
                        Ver todo en {cat.label}
                      </button>
                    )}
                    {cat.types.map(t => (
                      <button key={t.value} type="button" onClick={() => pickType(t.value)}
                        className={`w-full text-left px-3 py-2 text-sm ${value.productType === t.value ? 'bg-[#7fab87]/10 text-[#5a7a55] font-medium' : 'hover:bg-gray-50'}`}>
                        {t.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mobile: panel de pantalla completa, un nivel a la vez */}
          <div role="dialog" aria-modal="true" aria-label="Elegir categoría" className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col">
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 flex-shrink-0">
              {mobileStep !== 'department' && (
                <button type="button" aria-label="Volver"
                  onClick={() => setMobileStep(mobileStep === 'type' ? 'category' : 'department')}
                  className="p-2 -ml-2">
                  <ChevronLeft size={20} />
                </button>
              )}
              <p className="flex-1 text-sm tracking-widest uppercase text-gray-500 truncate">
                {mobileStep === 'department' && 'Departamento'}
                {mobileStep === 'category' && dept?.label}
                {mobileStep === 'type' && cat?.label}
              </p>
              <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} className="p-2 -mr-2">
                <X size={20} />
              </button>
            </div>

            {(value.department || value.productCategory) && (
              <p className="px-4 py-2 text-[10px] tracking-widest uppercase text-gray-400 border-b border-gray-50">
                {pathLabel(value) || 'Sin selección'}
              </p>
            )}

            <div className="flex-1 overflow-y-auto">
              {mobileStep === 'department' && (
                <>
                  {mode === 'filter' && (
                    <button type="button" onClick={clearAll}
                      className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-400 border-b border-gray-50">
                      Ver todo
                    </button>
                  )}
                  {TAXONOMY.map(d => (
                    <button key={d.value} type="button" onClick={() => pickDepartment(d.value)}
                      className={`w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50 ${value.department === d.value ? 'text-[#5a7a55] font-medium' : ''}`}>
                      {d.label}
                    </button>
                  ))}
                </>
              )}
              {mobileStep === 'category' && dept && (
                <>
                  {mode === 'filter' && (
                    <button type="button" onClick={() => { onChange({ department: dept.value, productCategory: '', productType: '' }); setOpen(false) }}
                      className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-400 border-b border-gray-50">
                      Ver todo en {dept.label}
                    </button>
                  )}
                  {dept.productCategories.map(c => (
                    <button key={c.value} type="button" onClick={() => pickCategory(c.value)}
                      className={`w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50 ${value.productCategory === c.value ? 'text-[#5a7a55] font-medium' : ''}`}>
                      {c.label}
                    </button>
                  ))}
                </>
              )}
              {mobileStep === 'type' && cat && (
                <>
                  {mode === 'filter' && (
                    <button type="button" onClick={() => { onChange({ department: value.department, productCategory: cat.value, productType: '' }); setOpen(false) }}
                      className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-400 border-b border-gray-50">
                      Ver todo en {cat.label}
                    </button>
                  )}
                  {cat.types.map(t => (
                    <button key={t.value} type="button" onClick={() => pickType(t.value)}
                      className={`w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50 ${value.productType === t.value ? 'text-[#5a7a55] font-medium' : ''}`}>
                      {t.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
