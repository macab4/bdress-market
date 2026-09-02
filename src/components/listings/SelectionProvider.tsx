'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2 } from 'lucide-react'
import CarouselFallbackModal from './CarouselFallbackModal'

// Instagram no deja compartir 4 fichas de una — el share sheet nativo solo
// toma un set de archivos. Esto junta varias fichas en un solo
// navigator.share({ files }) para que, al elegir Instagram, se abra el
// compositor de carrusel con todas las fotos ya cargadas (mismo mecanismo
// que compartir 4 fotos desde la galería). Tope real de Instagram: 10.
const MAX_SELECTION = 10

interface SelectionContextValue {
  selectedIds: Set<string>
  toggle: (id: string) => void
  clear: () => void
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection debe usarse dentro de <SelectionProvider>')
  return ctx
}

async function fetchPostImageFile(listingId: string): Promise<File> {
  const res = await fetch(`/api/listings/${listingId}/share-image?format=post`)
  if (!res.ok) throw new Error(`share-image ${listingId} → ${res.status}`)
  const blob = await res.blob()
  return new File([blob], `bdress-market-${listingId}.png`, { type: 'image/png' })
}

export default function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [fallbackFiles, setFallbackFiles] = useState<File[] | null>(null)
  const [error, setError] = useState('')

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECTION) {
          alert(`Puedes compartir hasta ${MAX_SELECTION} prendas en un carrusel de Instagram.`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelectedIds(new Set()), [])

  const value = useMemo(() => ({ selectedIds, toggle, clear }), [selectedIds, toggle, clear])

  async function shareCarousel() {
    if (selectedIds.size === 0 || loading) return
    setLoading(true)
    setError('')
    try {
      const files = await Promise.all([...selectedIds].map(fetchPostImageFile))
      const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files })
      if (navigator.share && canShareFiles) {
        try {
          await navigator.share({
            title: 'Prendas en B-Dress Market',
            text: 'Mira estas prendas en B-Dress Market',
            files,
          })
          clear()
        } catch {
          // La usuaria canceló el share nativo — no es un error a mostrar.
        }
      } else {
        // Desktop u otro navegador sin soporte de archivos en Web Share: se
        // ofrece descargar las imágenes para subirlas manualmente como carrusel.
        setFallbackFiles(files)
      }
    } catch {
      setError('No se pudieron generar las imágenes. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SelectionContext.Provider value={value}>
      {children}

      {selectedIds.size > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={clear} aria-label="Cancelar selección" className="text-gray-300 hover:text-white flex-shrink-0">
              <X size={18} />
            </button>
            <span className="text-xs tracking-widest uppercase truncate">
              {selectedIds.size} {selectedIds.size === 1 ? 'prenda seleccionada' : 'prendas seleccionadas'}
            </span>
          </div>
          <button
            type="button"
            onClick={shareCarousel}
            disabled={loading}
            className="flex-shrink-0 flex items-center gap-2 bg-[#7fab87] text-white text-xs tracking-widest uppercase px-4 py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Generando…' : 'Compartir carrusel'}
          </button>
        </div>,
        document.body
      )}

      {error && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white text-xs px-4 py-2 rounded shadow-lg">
          {error}
        </div>,
        document.body
      )}

      {fallbackFiles && (
        <CarouselFallbackModal
          files={fallbackFiles}
          onClose={() => { setFallbackFiles(null); clear() }}
        />
      )}
    </SelectionContext.Provider>
  )
}
