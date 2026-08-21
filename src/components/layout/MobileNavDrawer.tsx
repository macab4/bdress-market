'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, X } from 'lucide-react'
import { TAXONOMY, BRIDAL_EVENT_OCCASIONS, TaxonomyDepartment, TaxonomyProductCategory } from '@/lib/catalog'

const NOVIAS_HREF = `/?occasion=${encodeURIComponent(BRIDAL_EVENT_OCCASIONS.join(','))}`

type Step = 'root' | 'category' | 'type'

export default function MobileNavDrawer({ isLoggedIn, onClose }: { isLoggedIn: boolean; onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('root')
  const [dept, setDept] = useState<TaxonomyDepartment | null>(null)
  const [cat, setCat] = useState<TaxonomyProductCategory | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  function goTo(href: string) {
    router.push(href)
    onClose()
  }

  function pickDept(d: TaxonomyDepartment) {
    setDept(d)
    setStep('category')
  }

  function pickCat(c: TaxonomyProductCategory) {
    setCat(c)
    setStep('type')
  }

  function back() {
    if (step === 'type') setStep('category')
    else if (step === 'category') setStep('root')
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Categorías" className="fixed inset-0 z-50 bg-white flex flex-col md:hidden">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4 flex-shrink-0">
        {step !== 'root' && (
          <button type="button" aria-label="Volver" onClick={back} className="p-2 -ml-2">
            <ChevronLeft size={20} />
          </button>
        )}
        <p className="flex-1 text-sm tracking-widest uppercase text-gray-500 truncate">
          {step === 'root' && 'Categorías'}
          {step === 'category' && dept?.label}
          {step === 'type' && cat?.label}
        </p>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="p-2 -mr-2">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 'root' && (
          <>
            <button
              type="button"
              onClick={() => goTo(isLoggedIn ? '/listings/new' : '/auth/login?next=/listings/new')}
              className="w-full text-left px-4 min-h-11 py-3 text-sm font-medium text-[#5a7a55] border-b border-gray-50"
            >
              Vender una prenda
            </button>
            {TAXONOMY.map((d: TaxonomyDepartment) => (
              <button key={d.value} type="button" onClick={() => pickDept(d)}
                className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
                {d.label}
              </button>
            ))}
            <button type="button" onClick={() => goTo(NOVIAS_HREF)}
              className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
              Novias y eventos
            </button>
            <button type="button" onClick={() => goTo('/marcas')}
              className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
              Marcas
            </button>
            <button type="button" onClick={() => goTo('/')}
              className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
              Recién publicados
            </button>
            {!isLoggedIn && (
              <div className="mt-2">
                <button type="button" onClick={() => goTo('/auth/login')}
                  className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-500 border-b border-gray-50">
                  Ingresar
                </button>
                <button type="button" onClick={() => goTo('/auth/register')}
                  className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-500 border-b border-gray-50">
                  Crear cuenta
                </button>
              </div>
            )}
          </>
        )}

        {step === 'category' && dept && (
          <>
            <button type="button" onClick={() => goTo(`/?category=${dept.value}`)}
              className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-400 border-b border-gray-50">
              Ver todo en {dept.label}
            </button>
            {dept.productCategories.map((c: TaxonomyProductCategory) => (
              <button key={c.value} type="button" onClick={() => pickCat(c)}
                className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
                {c.label}
              </button>
            ))}
          </>
        )}

        {step === 'type' && dept && cat && (
          <>
            <button type="button" onClick={() => goTo(`/?category=${dept.value}&productCategory=${cat.value}`)}
              className="w-full text-left px-4 min-h-11 py-3 text-sm text-gray-400 border-b border-gray-50">
              Ver todo en {cat.label}
            </button>
            {cat.types.map(t => (
              <button key={t.value} type="button"
                onClick={() => goTo(`/?category=${dept.value}&productCategory=${cat.value}&productType=${encodeURIComponent(t.value)}`)}
                className="w-full text-left px-4 min-h-11 py-3 text-sm border-b border-gray-50">
                {t.label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
