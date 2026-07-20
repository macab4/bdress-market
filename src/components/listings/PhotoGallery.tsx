'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'

interface PhotoGalleryProps {
  photos: string[]
  title: string
}

export default function PhotoGallery({ photos, title }: PhotoGalleryProps) {
  const [active, setActive] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!lightboxOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxOpen(false)
      if (e.key === 'ArrowRight') setActive(a => (a + 1) % photos.length)
      if (e.key === 'ArrowLeft') setActive(a => (a - 1 + photos.length) % photos.length)
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [lightboxOpen, photos.length])

  if (photos.length === 0) {
    return (
      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center text-gray-300 text-sm">
        Sin fotos
      </div>
    )
  }

  function next(e: React.SyntheticEvent) {
    e.stopPropagation()
    setActive(a => (a + 1) % photos.length)
  }

  function prev(e: React.SyntheticEvent) {
    e.stopPropagation()
    setActive(a => (a - 1 + photos.length) % photos.length)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group aspect-[3/4] bg-gray-100 relative overflow-hidden block w-full"
        aria-label="Ver foto en pantalla completa"
      >
        <Image
          src={photos[active]}
          alt={title}
          fill
          className="object-cover"
          priority
        />
        <span className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <ZoomIn size={15} className="text-gray-700" />
        </span>
      </button>
      {photos.length > 1 && (
        <div className="grid grid-cols-5 gap-1">
          {photos.map((photo, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`aspect-square bg-gray-100 relative overflow-hidden border-2 transition ${
                active === i ? 'border-[#7fab87]' : 'border-transparent'
              }`}
            >
              <Image src={photo} alt={`${title} ${i + 1}`} fill className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false) }}
            aria-label="Cerrar"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X size={26} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Foto anterior"
                className="absolute left-2 sm:left-4 text-white/80 hover:text-white p-2"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Foto siguiente"
                className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-2"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          <div className="relative w-full h-full max-w-3xl max-h-[85vh] m-auto" onClick={(e) => e.stopPropagation()}>
            <Image src={photos[active]} alt={`${title} ${active + 1}`} fill className="object-contain" />
          </div>

          {photos.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs tracking-widest">
              {active + 1} / {photos.length}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
