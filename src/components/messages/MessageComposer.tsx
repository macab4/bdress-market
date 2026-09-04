'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { moderateMessage, MODERATION_MESSAGE } from '@/lib/messageModeration'
import { createClient } from '@/lib/supabase/client'
import { CHAT_ATTACHMENTS_BUCKET, buildAttachmentPath, sniffAttachmentMime, isVideoMime } from '@/lib/chatAttachments'
import ChatImageUpload from './ChatImageUpload'

interface Props {
  listingId: string
  receiverId: string
}

export default function MessageComposer({ listingId, receiverId }: Props) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => {
    return () => previews.forEach(url => URL.revokeObjectURL(url))
  }, [previews])

  function removeFileAt(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed && files.length === 0) return

    // Chequeo rápido en el cliente para no ir y volver al servidor — el
    // servidor igual vuelve a validar, así que esto es solo para feedback
    // instantáneo, no la barrera de seguridad real.
    if (trimmed && moderateMessage(trimmed).blocked) {
      setError(MODERATION_MESSAGE)
      return
    }

    setLoading(true)
    setError('')

    try {
      const attachments = files.length > 0 ? await uploadAttachments(listingId, files) : []

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, receiver_id: receiverId, content: trimmed, attachments }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar el mensaje')

      setContent('')
      setFiles([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el mensaje')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {previews.length > 0 && (
        <div className="flex gap-2 mb-2 flex-wrap">
          {previews.map((url, i) => (
            <div key={url} className="relative w-14 h-14 flex-shrink-0 bg-black">
              {isVideoMime(files[i].type) ? (
                <video src={url} muted preload="metadata" className="w-full h-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeFileAt(i)}
                aria-label="Quitar archivo"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black text-white flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <ChatImageUpload files={files} onFilesChange={setFiles} disabled={loading} />
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Escribe un mensaje..."
          className="flex-1 border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
        />
        <button
          type="submit"
          disabled={loading || (!content.trim() && files.length === 0)}
          className="bg-[#7fab87] text-white text-xs tracking-widest uppercase px-4 py-2.5 hover:bg-[#6f9678] transition disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}

async function uploadAttachments(listingId: string, files: File[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Tu sesión expiró — volvé a iniciar sesión.')

  return Promise.all(files.map(async (file) => {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const mime = sniffAttachmentMime(bytes, file.type)
    if (!mime) throw new Error('Uno de los archivos no es una foto o video válido (JPG, PNG, WEBP, MP4 o MOV).')

    const path = buildAttachmentPath(listingId, user.id, mime)
    const { error } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(path, file, { contentType: mime })
    if (error) throw new Error(`No se pudo subir un archivo: ${error.message}`)

    return { storage_path: path, mime_type: mime, size_bytes: file.size }
  }))
}
