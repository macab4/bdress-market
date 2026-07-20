'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'

type PhotoItem =
  | { id: string; kind: 'existing'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string }

export default function AdminPhotoEditor({ listingId, initialPhotos }: { listingId: string; initialPhotos: string[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos.map(url => ({ id: url, kind: 'existing', url })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const availableSlots = 5 - photos.length
    const files = Array.from(e.target.files || []).slice(0, availableSlots)
    const newItems: PhotoItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'new',
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos(prev => [...prev, ...newItems])
    setSaved(false)
  }

  function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
    setSaved(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPhotos(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id)
      const newIndex = prev.findIndex(p => p.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
    setSaved(false)
  }

  async function handleSave() {
    if (photos.length === 0) { setError('La prenda necesita al menos una foto'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Sesión inválida'); setSaving(false); return }

    const orderedUrls: string[] = []
    for (const item of photos) {
      if (item.kind === 'existing') { orderedUrls.push(item.url); continue }

      const ext = item.file.name.split('.').pop()
      const path = `admin-edits/${listingId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('listings').upload(path, item.file, { contentType: item.file.type })
      if (uploadError) { setError('Error subiendo foto: ' + uploadError.message); setSaving(false); return }

      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
      orderedUrls.push(publicUrl)
    }

    const res = await fetch(`/api/admin/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: orderedUrls }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Error guardando las fotos')
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {photos.map((item, i) => (
              <SortableAdminPhoto key={item.id} item={item} isCover={i === 0} onRemove={() => removePhoto(item.id)} />
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-2xl hover:bg-gray-200 transition">
                +
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
      <p className="text-[10px] text-gray-400 mb-3">Arrastra para reordenar. La primera foto es la portada.</p>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      <button type="button" onClick={handleSave} disabled={saving}
        className="bg-[#7fab87] text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-[#6f9678] transition disabled:opacity-50">
        {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar cambios'}
      </button>
    </div>
  )
}

function SortableAdminPhoto({ item, isCover, onRemove }: { item: PhotoItem; isCover: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="relative aspect-square bg-gray-100 touch-none cursor-grab active:cursor-grabbing">
      <Image src={item.kind === 'existing' ? item.url : item.preview} alt="" fill className="object-cover pointer-events-none" />

      {isCover && (
        <span className="absolute top-1 left-1 bg-[#7fab87] text-white text-[8px] tracking-widest uppercase px-1.5 py-0.5">
          Portada
        </span>
      )}

      <button
        type="button"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="absolute top-0 right-0 bg-black text-white text-xs w-5 h-5 flex items-center justify-center z-10"
      >
        ×
      </button>
    </div>
  )
}
