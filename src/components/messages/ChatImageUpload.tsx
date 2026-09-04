'use client'

import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_BYTES } from '@/lib/chatAttachments'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
}

// Botón "+" del chat (por ahora solo adjunta fotos — hacer oferta/crear lote
// se agregan en fases futuras del rediseño, ver plan de mensajería).
export default function ChatImageUpload({ files, onFilesChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const valid = picked.filter(f =>
      (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(f.type) && f.size <= MAX_ATTACHMENT_BYTES
    )
    onFilesChange([...files, ...valid].slice(0, MAX_ATTACHMENTS_PER_MESSAGE))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= MAX_ATTACHMENTS_PER_MESSAGE}
        aria-label="Adjuntar foto"
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:text-black hover:border-gray-400 transition disabled:opacity-40"
      >
        <ImagePlus size={16} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(',')}
        multiple
        hidden
        onChange={handleSelect}
      />
    </>
  )
}
