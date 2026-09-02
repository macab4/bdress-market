'use client'

import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Download } from 'lucide-react'

// Fallback para cuando navigator.share no soporta archivos (desktop,
// principalmente) — mismo patrón que ShareFallbackModal, pero para varias
// imágenes: se descargan todas para subirlas a mano como carrusel en la app
// de Instagram (no hay forma de abrir el compositor de carrusel desde web).
export default function CarouselFallbackModal({ files, onClose }: { files: File[]; onClose: () => void }) {
  const urls = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      urls.forEach(url => URL.revokeObjectURL(url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose])

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function downloadAll() {
    files.forEach((file, i) => {
      const a = document.createElement('a')
      a.href = urls[i]
      a.download = file.name
      a.click()
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => { stop(e); onClose() }}
    >
      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto bg-white p-6 sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => { stop(e); onClose() }}
          aria-label="Cerrar"
          className="absolute top-4 right-4 text-gray-400 hover:text-black"
        >
          <X size={20} />
        </button>

        <h2 className="text-base font-medium mb-1">Compartir carrusel</h2>
        <p className="text-xs text-gray-500 mb-6">
          Tu navegador no permite abrir Instagram directamente con varias fotos. Descarga las {files.length} imágenes y súbelas juntas como carrusel desde la app.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {urls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-full aspect-[4/5] object-cover bg-gray-100" />
          ))}
        </div>

        <button
          type="button"
          onClick={(e) => { stop(e); downloadAll() }}
          className="w-full flex items-center justify-center gap-2 bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3.5 hover:bg-[#6f9678] transition"
        >
          <Download size={14} />
          Descargar las {files.length} imágenes
        </button>
      </div>
    </div>,
    document.body
  )
}
