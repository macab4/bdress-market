'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, Download } from 'lucide-react'

// Fallback para cuando navigator.share no existe (desktop, algunos
// navegadores) — mismo patrón de modal que InternationalInfoModal.tsx.
export default function ShareFallbackModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles — no hay mucho más que hacer.
    }
  }

  // La imagen recién se pide acá, al tocar el botón — no antes, ni siquiera
  // al abrir este modal (ver objetivo de performance en ShareButton).
  async function downloadImage() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/share-image`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = 'bdress-market.png'
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      alert('No se pudo descargar la imagen. Intenta de nuevo.')
    } finally {
      setDownloading(false)
    }
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

        <h2 className="text-base font-medium mb-6">Compartir esta prenda</h2>

        <div className="space-y-3">
          <button
            type="button"
            onClick={(e) => { stop(e); copyLink() }}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 text-xs tracking-widest uppercase py-3.5 hover:border-[#7fab87] hover:text-[#7fab87] transition"
          >
            {copied ? <Check size={14} className="text-[#5a7a55]" /> : <Copy size={14} />}
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>

          <button
            type="button"
            onClick={(e) => { stop(e); downloadImage() }}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3.5 hover:bg-[#6f9678] transition disabled:opacity-50"
          >
            <Download size={14} />
            {downloading ? 'Generando…' : 'Descargar imagen para compartir'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
