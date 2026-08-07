'use client'

import { useEffect, useState, useTransition, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  CONDITION_GROUPS, CategoryValue, ALL_SIZES, sizeOptionsFor,
  LENGTHS, LENGTH_APPLICABLE_TYPES, OCCASIONS, MATERIALS,
  departmentEntry, productCategoryLabel,
} from '@/lib/catalog'
import CategoryPicker, { type CategoryPickerValue } from '@/components/listings/CategoryPicker'
import ColorFilterPopover from '@/components/listings/ColorFilterPopover'

const SORT_OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'antiguas', label: 'Más antiguas' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
] as const

// max-w acá no es solo estético: sin tope, un <select> nativo con muchas
// <option> (ej. las ~230 marcas) se dimensiona según la opción MÁS ANCHA de
// la lista, no según el texto visible ("Marca") — es un comportamiento real
// de Chrome/WebKit. Sin este límite, esa caja invisible de ~600px+ obliga a
// toda la página a necesitar ese ancho mínimo, y en mobile el navegador la
// muestra "alejada" para que todo entre. min-w-0 la deja participar del
// flex-wrap en vez de imponer su propio mínimo.
const capsuleClass = 'border border-gray-200 px-3 py-2 text-xs bg-white text-left hover:border-gray-400 whitespace-nowrap min-w-0 max-w-[150px]'
const mobileRowClass = 'w-full border border-gray-200 px-3 py-2.5 text-sm bg-white text-left'

export default function CatalogFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [brands, setBrands] = useState<{ slug: string; label: string }[]>([])
  const urlQ = searchParams.get('q') ?? ''
  const [qInput, setQInput] = useState(urlQ)
  const [syncedQ, setSyncedQ] = useState(urlQ)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Si la URL cambia por fuera (atrás/adelante del navegador, o se limpiaron
  // los filtros), refleja el nuevo valor en el input — sin useEffect, para no
  // disparar un render extra después de otro.
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ)
    setQInput(urlQ)
  }

  useEffect(() => {
    let cancelled = false
    async function loadBrands() {
      const supabase = createClient()
      // Directo desde la tabla de marcas canónicas — ya viene deduplicada,
      // sin tener que agrupar texto libre en el cliente (ver src/lib/brands.ts).
      const { data } = await supabase.from('brands').select('slug, display_name').order('display_name')
      if (cancelled || !data) return
      setBrands(data.map(b => ({ slug: b.slug, label: b.display_name })))
    }
    loadBrands()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!mobileFiltersOpen) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [mobileFiltersOpen])

  function pushParams(mutate: (usp: URLSearchParams) => void, opts?: { resetPage?: boolean }) {
    const usp = new URLSearchParams(searchParams.toString())
    mutate(usp)
    if (opts?.resetPage !== false) usp.delete('page')
    const qs = usp.toString()
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function setParam(key: string, value: string) {
    pushParams(usp => {
      if (value) usp.set(key, value)
      else usp.delete(key)
    })
  }

  function removeParam(key: string) {
    pushParams(usp => usp.delete(key))
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }))
  }

  function handleQChange(v: string) {
    setQInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setParam('q', v.trim()), 350)
  }

  const department = (searchParams.get('category') ?? '') as CategoryValue | ''
  const productCategory = searchParams.get('productCategory') ?? ''
  const productType = searchParams.get('productType') ?? ''
  const size = searchParams.get('size') ?? ''
  const brand = searchParams.get('brand') ?? ''
  const condition = searchParams.get('condition') ?? ''
  const color = searchParams.get('color') ?? ''
  const min = searchParams.get('min') ?? ''
  const max = searchParams.get('max') ?? ''
  const material = searchParams.get('material') ?? ''
  const occasion = searchParams.get('occasion') ?? ''
  const length = searchParams.get('length') ?? ''
  const sort = searchParams.get('sort') ?? 'recientes'

  const sizeOptions = department && productCategory ? sizeOptionsFor(department, productCategory) : ALL_SIZES
  const showLength = LENGTH_APPLICABLE_TYPES.includes(productType)
  const showSize = !department || !productCategory || sizeOptions.length > 0

  const categoryPickerValue: CategoryPickerValue = { department, productCategory, productType }

  type Chip = { key: string; label: string; onRemove: () => void }
  const chips: Chip[] = []
  if (qInput) chips.push({ key: 'q', label: `"${qInput}"`, onRemove: () => { setQInput(''); removeParam('q') } })
  if (department) {
    const dept = departmentEntry(department)
    const catLabel = productCategory ? productCategoryLabel(department, productCategory) : null
    const label = [dept?.label, catLabel, productType].filter(Boolean).join(' › ')
    chips.push({ key: 'category', label, onRemove: () => pushParams(usp => { usp.delete('category'); usp.delete('productCategory'); usp.delete('productType') }) })
  }
  if (size) chips.push({ key: 'size', label: `Talla ${size}`, onRemove: () => removeParam('size') })
  if (brand) chips.push({ key: 'brand', label: brands.find(b => b.slug === brand)?.label ?? brand, onRemove: () => removeParam('brand') })
  if (condition) chips.push({ key: 'condition', label: CONDITION_GROUPS.find(g => g.value === condition)?.label ?? condition, onRemove: () => removeParam('condition') })
  if (color) chips.push({ key: 'color', label: color.split(',').join(', '), onRemove: () => removeParam('color') })
  if (material) chips.push({ key: 'material', label: material, onRemove: () => removeParam('material') })
  if (occasion) chips.push({ key: 'occasion', label: occasion, onRemove: () => removeParam('occasion') })
  if (length) chips.push({ key: 'length', label: `Largo ${length}`, onRemove: () => removeParam('length') })
  if (min) chips.push({ key: 'min', label: `Desde $${parseInt(min).toLocaleString('es-CL')}`, onRemove: () => removeParam('min') })
  if (max) chips.push({ key: 'max', label: `Hasta $${parseInt(max).toLocaleString('es-CL')}`, onRemove: () => removeParam('max') })

  const activeFilterCount = chips.filter(c => c.key !== 'q').length

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="mb-3">
          <input
            value={qInput}
            onChange={e => handleQChange(e.target.value)}
            placeholder="Busca por prenda, marca, color o estilo"
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
          />
        </div>

        {/* Desktop: todos los filtros en línea */}
        <div className="hidden md:flex flex-wrap gap-2">
          <CategoryPicker mode="filter" value={categoryPickerValue}
            onChange={(v: CategoryPickerValue) => pushParams(usp => {
              if (v.department) usp.set('category', v.department); else usp.delete('category')
              if (v.productCategory) usp.set('productCategory', v.productCategory); else usp.delete('productCategory')
              if (v.productType) usp.set('productType', v.productType); else usp.delete('productType')
            })}
            triggerClassName={capsuleClass}
            triggerLabel="Categoría"
          />

          {showSize && (
            <select value={size} onChange={e => setParam('size', e.target.value)} className={capsuleClass}>
              <option value="">Talla</option>
              {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          <select value={brand} onChange={e => setParam('brand', e.target.value)} className={capsuleClass}>
            <option value="">Marca</option>
            {brands.map(b => <option key={b.slug} value={b.slug}>{b.label}</option>)}
          </select>

          <select value={condition} onChange={e => setParam('condition', e.target.value)} className={capsuleClass}>
            <option value="">Estado</option>
            {CONDITION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>

          <ColorFilterPopover defaultValue={color || undefined} onApply={(v: string) => setParam('color', v)} />

          <select value={material} onChange={e => setParam('material', e.target.value)} className={capsuleClass}>
            <option value="">Material</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select value={occasion} onChange={e => setParam('occasion', e.target.value)} className={capsuleClass}>
            <option value="">Ocasión</option>
            {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {showLength && (
            <select value={length} onChange={e => setParam('length', e.target.value)} className={capsuleClass}>
              <option value="">Largo</option>
              {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}

          <details className="relative">
            <summary className={`${capsuleClass} list-none cursor-pointer`}>
              Precio{(min || max) ? ` · $${min || '0'}–$${max || '∞'}` : ''}
            </summary>
            <div className="absolute z-20 mt-2 bg-white border border-gray-200 shadow-lg p-3 w-56 space-y-2">
              <div className="flex gap-2">
                <input type="number" placeholder="Mín." defaultValue={min}
                  onBlur={e => setParam('min', e.target.value)}
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none" />
                <input type="number" placeholder="Máx." defaultValue={max}
                  onBlur={e => setParam('max', e.target.value)}
                  className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1 text-xs text-gray-500">
                <button type="button" className="text-left hover:text-black" onClick={() => pushParams(usp => { usp.delete('min'); usp.set('max', '50000') })}>Hasta $50.000</button>
                <button type="button" className="text-left hover:text-black" onClick={() => pushParams(usp => { usp.set('min', '50000'); usp.set('max', '100000') })}>$50.000 a $100.000</button>
                <button type="button" className="text-left hover:text-black" onClick={() => pushParams(usp => { usp.set('min', '100000'); usp.set('max', '200000') })}>$100.000 a $200.000</button>
                <button type="button" className="text-left hover:text-black" onClick={() => pushParams(usp => { usp.set('min', '200000'); usp.delete('max') })}>Más de $200.000</button>
              </div>
            </div>
          </details>

          <select value={sort} onChange={e => setParam('sort', e.target.value)} className={capsuleClass}>
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Mobile: buscador (arriba) + Filtros + Ordenar */}
        <div className="flex md:hidden gap-2">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex-1 min-w-0 border border-gray-200 px-3 py-2.5 text-xs tracking-widest uppercase bg-white flex items-center justify-center gap-2"
          >
            <SlidersHorizontal size={14} />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <select
            value={sort}
            onChange={e => setParam('sort', e.target.value)}
            aria-label="Ordenar"
            className="flex-1 min-w-0 border border-gray-200 px-3 py-2.5 text-xs bg-white"
          >
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3 overflow-x-auto">
            {chips.map(chip => (
              <button key={chip.key} type="button" onClick={chip.onRemove}
                className="flex items-center gap-1.5 bg-[#7fab87]/10 text-[#5a7a55] text-xs px-2.5 py-1 hover:bg-[#7fab87]/20 focus:outline-none focus:ring-1 focus:ring-[#7fab87]">
                {chip.label}
                <span aria-hidden="true">×</span>
                <span className="sr-only">Quitar filtro {chip.label}</span>
              </button>
            ))}
            <button type="button" onClick={clearAll} className="text-xs text-gray-400 hover:text-black underline ml-1">
              Limpiar todo
            </button>
          </div>
        )}
      </div>

      {/* Mobile: drawer de pantalla completa con el resto de los filtros */}
      {mobileFiltersOpen && (
        <div role="dialog" aria-modal="true" aria-label="Filtros" className="md:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4 flex-shrink-0">
            <p className="text-sm tracking-widest uppercase text-gray-500">Filtros</p>
            <button type="button" aria-label="Cerrar" onClick={() => setMobileFiltersOpen(false)} className="p-2 -mr-2">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <CategoryPicker mode="filter" value={categoryPickerValue}
              onChange={(v: CategoryPickerValue) => pushParams(usp => {
                if (v.department) usp.set('category', v.department); else usp.delete('category')
                if (v.productCategory) usp.set('productCategory', v.productCategory); else usp.delete('productCategory')
                if (v.productType) usp.set('productType', v.productType); else usp.delete('productType')
              })}
              triggerClassName={mobileRowClass}
              triggerLabel="Categoría"
            />

            {showSize && (
              <select value={size} onChange={e => setParam('size', e.target.value)} className={mobileRowClass}>
                <option value="">Talla</option>
                {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}

            <select value={brand} onChange={e => setParam('brand', e.target.value)} className={mobileRowClass}>
              <option value="">Marca</option>
              {brands.map(b => <option key={b.slug} value={b.slug}>{b.label}</option>)}
            </select>

            <select value={condition} onChange={e => setParam('condition', e.target.value)} className={mobileRowClass}>
              <option value="">Estado</option>
              {CONDITION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>

            <ColorFilterPopover
              defaultValue={color || undefined}
              onApply={(v: string) => setParam('color', v)}
              triggerClassName={`${mobileRowClass} flex items-center justify-between`}
            />

            <select value={material} onChange={e => setParam('material', e.target.value)} className={mobileRowClass}>
              <option value="">Material</option>
              {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            <select value={occasion} onChange={e => setParam('occasion', e.target.value)} className={mobileRowClass}>
              <option value="">Ocasión</option>
              {OCCASIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {showLength && (
              <select value={length} onChange={e => setParam('length', e.target.value)} className={mobileRowClass}>
                <option value="">Largo</option>
                {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}

            <div>
              <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Precio</p>
              <div className="flex gap-2">
                <input type="number" placeholder="Mín." defaultValue={min}
                  onBlur={e => setParam('min', e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
                <input type="number" placeholder="Máx." defaultValue={max}
                  onBlur={e => setParam('max', e.target.value)}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-100 p-4 flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => { clearAll(); setMobileFiltersOpen(false) }} className="text-xs text-gray-400 hover:text-black underline">
              Limpiar todo
            </button>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(false)}
              className="flex-1 bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition"
            >
              Ver resultados
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
