'use client'

import { useState } from 'react'
import { Share, Loader2 } from 'lucide-react'
import ShareFallbackModal from './ShareFallbackModal'

interface Props {
  listingId: string
  title: string
  buttonClassName?: string
}

const IMAGE_FETCH_TIMEOUT_MS = 4000

async function fetchShareImageFile(listingId: string): Promise<File | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`/api/listings/${listingId}/share-image`, { signal: controller.signal })
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], 'bdress-market.png', { type: 'image/png' })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default function ShareButton({ listingId, title, buttonClassName = '' }: Props) {
  const [loading, setLoading] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const url = window.location.href
    const shareTitle = `${title} en B-Dress Market`
    const shareText = 'Mira esta prenda en B-Dress Market'

    if (navigator.share) {
      setLoading(true)
      // La imagen es "mejor esfuerzo": si tarda o falla, igual se comparte
      // título + texto + URL sin bloquear el share sheet nativo por eso.
      const file = await fetchShareImageFile(listingId)
      const canShareFiles = file !== null && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      setLoading(false)

      try {
        await navigator.share(
          canShareFiles
            ? { title: shareTitle, text: shareText, url, files: [file as File] }
            : { title: shareTitle, text: shareText, url }
        )
      } catch {
        // La usuaria canceló el share nativo — no es un error a mostrar.
      }
      return
    }

    setShowFallback(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        aria-label="Compartir esta prenda"
        className={`w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition disabled:opacity-50 ${buttonClassName}`}
      >
        {loading ? <Loader2 size={14} className="text-gray-500 animate-spin" /> : <Share size={14} className="text-gray-500" />}
      </button>

      {showFallback && (
        <ShareFallbackModal listingId={listingId} onClose={() => setShowFallback(false)} />
      )}
    </>
  )
}
