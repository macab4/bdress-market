'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { TAXONOMY, BRIDAL_EVENT_OCCASIONS, CategoryValue } from '@/lib/catalog'
import MobileNavDrawer from '@/components/layout/MobileNavDrawer'

const NOVIAS_HREF = `/?occasion=${encodeURIComponent(BRIDAL_EVENT_OCCASIONS.join(','))}`

export default function MainNavClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [openDept, setOpenDept] = useState<CategoryValue | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openDept) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenDept(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenDept(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openDept])

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenDept(null), 150)
  }

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  return (
    <div ref={rootRef} className="bg-white border-b border-gray-100 relative">
      <div className="max-w-5xl mx-auto px-4">
        {/* Mobile: hamburger */}
        <div className="md:hidden flex items-center py-2.5">
          <button type="button" onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-gray-600">
            <Menu size={18} />
            Categorías
          </button>
        </div>

        {/* Desktop */}
        <nav aria-label="Categorías" className="hidden md:flex items-center gap-6 py-2.5 text-xs tracking-widest uppercase text-gray-600">
          {TAXONOMY.map(dept => (
            <div key={dept.value} className="relative"
              onMouseEnter={() => { cancelClose(); setOpenDept(dept.value) }}
              onMouseLeave={scheduleClose}>
              <button type="button"
                aria-expanded={openDept === dept.value}
                aria-haspopup="true"
                onClick={() => setOpenDept(prev => prev === dept.value ? null : dept.value)}
                className={`hover:text-black transition ${openDept === dept.value ? 'text-black' : ''}`}>
                {dept.label}
              </button>

              {openDept === dept.value && (
                <div role="menu" aria-label={dept.label}
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                  className="absolute z-40 top-full left-0 mt-2 bg-white border border-gray-200 shadow-lg p-6 flex gap-8 min-w-[420px]">
                  {dept.productCategories.map(cat => (
                    <div key={cat.value} className="min-w-[140px]">
                      <Link href={`/?category=${dept.value}&productCategory=${cat.value}`}
                        onClick={() => setOpenDept(null)}
                        className="block text-[10px] tracking-widest uppercase text-gray-400 hover:text-black mb-2 normal-case">
                        {cat.label}
                      </Link>
                      <ul className="space-y-1.5">
                        {cat.types.map(t => (
                          <li key={t.value}>
                            <Link
                              href={`/?category=${dept.value}&productCategory=${cat.value}&productType=${encodeURIComponent(t.value)}`}
                              onClick={() => setOpenDept(null)}
                              className="block text-sm normal-case tracking-normal text-gray-700 hover:text-[#5a7a55]">
                              {t.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="min-w-[100px] flex items-start">
                    <Link href={`/?category=${dept.value}`}
                      onClick={() => setOpenDept(null)}
                      className="text-sm normal-case tracking-normal text-[#5a7a55] underline underline-offset-2">
                      Ver todo en {dept.label}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}

          <Link href={NOVIAS_HREF} className="hover:text-black transition">Novias y eventos</Link>
          <Link href="/marcas" className="hover:text-black transition">Marcas</Link>
          <Link href="/" className="hover:text-black transition">Recién publicados</Link>
        </nav>
      </div>

      {drawerOpen && <MobileNavDrawer isLoggedIn={isLoggedIn} onClose={() => setDrawerOpen(false)} />}
    </div>
  )
}
