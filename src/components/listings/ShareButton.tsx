'use client'

import { useState } from 'react'
import { Share, Check } from 'lucide-react'

interface Props {
  title: string
  buttonClassName?: string
}

export default function ShareButton({ title, buttonClassName = '' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // La usuaria canceló el share nativo — no es un error a mostrar.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin permiso de portapapeles — no hay mucho más que hacer sin backend.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Compartir esta prenda"
      className={`w-7 h-7 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition ${buttonClassName}`}
    >
      {copied ? <Check size={14} className="text-[#5a7a55]" /> : <Share size={14} className="text-gray-500" />}
    </button>
  )
}
