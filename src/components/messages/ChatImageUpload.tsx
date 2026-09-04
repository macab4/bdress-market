'use client'

import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEOS_PER_MESSAGE,
  isVideoMime,
} from '@/lib/chatAttachments'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
}

// Botón "+" del chat (por ahora solo adjunta fotos/video — hacer oferta/crear
// lote se agregan en fases futuras del rediseño, ver plan de mensajería).
export default function ChatImageUpload({ files, onFilesChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoCount = files.filter(f => isVideoMime(f.type)).length
  const atLimit = files.length >= MAX_ATTACHMENTS_PER_MESSAGE

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''

    let videos = videoCount
    const valid = picked.filter(f => {
      if (!(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(f.type)) return false
      if (isVideoMime(f.type)) {
        if (f.size > MAX_VIDEO_BYTES || videos >= MAX_VIDEOS_PER_MESSAGE) return false
        videos += 1
        return true
      }
      return f.size <= MAX_ATTACHMENT_BYTES
    })

    onFilesChange([...files, ...valid].slice(0, MAX_ATTACHMENTS_PER_MESSAGE))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || atLimit}
        aria-label="Adjuntar foto o video"
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:text-black hover:border-gray-400 transition disabled:opacity-40"
      >
        <ImagePlus size={16} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={(videoCount >= MAX_VIDEOS_PER_MESSAGE ? ALLOWED_IMAGE_MIME_TYPES : ALLOWED_ATTACHMENT_MIME_TYPES).join(',')}
        multiple
        hidden
        onChange={handleSelect}
      />
    </>
  )
}
