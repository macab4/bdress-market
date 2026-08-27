'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { type Area } from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { compressImage, getCroppedImageBlob } from '@/lib/imageUpload'
import { PHOTO_ENHANCE_ACTIONS, PhotoEnhanceAction } from '@/lib/nanoBanana'
import { CropModal } from '@/components/listings/ListingForm'
import { useBrandField } from '@/components/listings/useBrandField'
import { CONDITIONS, COLORS, SHIPPING_SIZES, MAX_LISTING_COLORS, CategoryValue, sizeOptionsFor, TAXONOMY } from '@/lib/catalog'

interface AdminListingFormProps {
  sellerId: string
  sellerName: string
}

const MAX_PHOTOS = 5

// Publica una prenda a nombre de OTRA usuaria — para cuando alguien no puede
// o no logra publicar sola (ver /admin/users/[id]). Calcado de
// InternationalListingForm.tsx (mismo editor de fotos, mismo patrón de
// submit por fetch a un endpoint admin), pero sin los campos de origen
// internacional — esto es una prenda real de una vendedora real.
type PhotoItem =
  | { id: string; kind: 'existing'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string; original?: { file: File; preview: string } }

export default function AdminListingForm({ sellerId, sellerName }: AdminListingFormProps) {
  const router = useRouter()

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '' as CategoryValue | '',
    productCategory: '',
    productType: '',
    size: '',
    condition: 'muy_bueno' as typeof CONDITIONS[number]['value'],
    colors: [] as string[],
    shipping_size: 'mediano' as typeof SHIPPING_SIZES[number]['value'],
    price: '',
  })
  const { brandInput, setBrandInput, resolveBrand, brandOptions } = useBrandField('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [enhancingId, setEnhancingId] = useState<string | null>(null)
  const [enhanceErrors, setEnhanceErrors] = useState<Record<string, string>>({})
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [cropTargetId, setCropTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function toggleColor(value: string) {
    setForm(prev => {
      if (prev.colors.includes(value)) return { ...prev, colors: prev.colors.filter(c => c !== value) }
      if (prev.colors.length >= MAX_LISTING_COLORS) return prev
      return { ...prev, colors: [...prev.colors, value] }
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const availableSlots = MAX_PHOTOS - photos.length
    const list = Array.from(files).slice(0, availableSlots)
    const compressedFiles = await Promise.all(list.map(file => compressImage(file)))
    const newItems: PhotoItem[] = compressedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      kind: 'new',
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos(prev => [...prev, ...newItems])
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  async function ensureEditableFile(id: string): Promise<{ file: File; preview: string } | null> {
    const item = photos.find(p => p.id === id)
    if (!item) return null
    if (item.kind === 'new') return { file: item.file, preview: item.preview }

    try {
      const res = await fetch(item.url)
      if (!res.ok) throw new Error('No se pudo cargar la foto')
      const blob = await res.blob()
      const file = new File([blob], 'foto.jpg', { type: blob.type || 'image/jpeg' })
      const preview = URL.createObjectURL(file)
      setPhotos(prev => prev.map(p => (p.id === id ? { id, kind: 'new', file, preview } : p)))
      return { file, preview }
    } catch {
      setEnhanceErrors(prev => ({ ...prev, [id]: 'No se pudo cargar la foto para editarla' }))
      return null
    }
  }

  async function enhancePhoto(id: string, action: PhotoEnhanceAction) {
    setMenuOpenId(null)
    setEnhancingId(id)
    setEnhanceErrors(prev => { const next = { ...prev }; delete next[id]; return next })

    const fileInfo = await ensureEditableFile(id)
    if (!fileInfo) { setEnhancingId(null); return }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45_000)
    try {
      const body = new FormData()
      body.append('photo', fileInfo.file)
      body.append('action', action)
      const res = await fetch('/api/listings/enhance-photo', { method: 'POST', body, signal: controller.signal })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `Error al mejorar la foto (${res.status})`)
      }
      const blob = await res.blob()
      const enhancedFile = new File([blob], fileInfo.file.name, { type: 'image/png' })
      const newPreview = URL.createObjectURL(enhancedFile)
      setPhotos(prev => prev.map(p =>
        p.id === id && p.kind === 'new'
          ? { ...p, file: enhancedFile, preview: newPreview, original: p.original ?? { file: p.file, preview: p.preview } }
          : p
      ))
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Tardó demasiado — intenta con otra foto o de nuevo'
        : err instanceof Error ? err.message : 'Error al mejorar la foto'
      setEnhanceErrors(prev => ({ ...prev, [id]: message }))
    } finally {
      clearTimeout(timeout)
      setEnhancingId(null)
    }
  }

  function revertPhoto(id: string) {
    setPhotos(prev => prev.map(p => {
      if (p.id !== id || p.kind !== 'new' || !p.original) return p
      URL.revokeObjectURL(p.preview)
      return { id: p.id, kind: 'new', file: p.original.file, preview: p.original.preview }
    }))
  }

  async function openCropModal(id: string) {
    const fileInfo = await ensureEditableFile(id)
    if (fileInfo) setCropTargetId(id)
  }

  async function applyCrop(id: string, area: Area) {
    const item = photos.find(p => p.id === id)
    if (!item || item.kind !== 'new') return

    try {
      const blob = await getCroppedImageBlob(item.preview, area)
      const croppedFile = new File([blob], item.file.name, { type: 'image/jpeg' })
      const newPreview = URL.createObjectURL(croppedFile)
      setPhotos(prev => prev.map(p =>
        p.id === id && p.kind === 'new'
          ? { ...p, file: croppedFile, preview: newPreview, original: p.original ?? { file: p.file, preview: p.preview } }
          : p
      ))
    } catch (err) {
      setEnhanceErrors(prev => ({ ...prev, [id]: err instanceof Error ? err.message : 'Error al recortar la foto' }))
    } finally {
      setCropTargetId(null)
    }
  }

  const productCategories = TAXONOMY.find(d => d.value === form.category)?.productCategories ?? []
  const productTypes = productCategories.find(c => c.value === form.productCategory)?.types ?? []
  const sizeOptions = form.category && form.productCategory ? sizeOptionsFor(form.category, form.productCategory) : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.category || !form.size || !brandInput.trim()) {
      setError('Completa título, categoría, talla y marca')
      return
    }
    const price = Number(form.price)
    if (!price || price <= 0) {
      setError('Ingresa un precio válido')
      return
    }
    if (photos.length === 0) {
      setError('Agrega al menos una fotografía')
      return
    }

    setLoading(true)
    setUploading(true)

    const supabase = createClient()

    // Las fotos se suben a la carpeta de la VENDEDORA (sellerId), no de la
    // admin — así quedan consistentes con cómo se guardarían si ella misma
    // las hubiera subido, y con cualquier policy de Storage basada en carpeta.
    const orderedUrls: string[] = []
    for (const item of photos) {
      if (item.kind === 'existing') { orderedUrls.push(item.url); continue }

      const ext = item.file.name.split('.').pop() || 'jpg'
      const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('listings').upload(path, item.file, { contentType: item.file.type })
      if (uploadErr) { setError('Error subiendo foto: ' + uploadErr.message); setLoading(false); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
      orderedUrls.push(publicUrl)
    }
    setUploading(false)

    let resolvedBrand: { id: string; display_name: string } | null
    try {
      resolvedBrand = await resolveBrand()
    } catch {
      setError('No se pudo verificar la marca — intenta de nuevo')
      setLoading(false)
      return
    }

    const payload = {
      seller_id: sellerId,
      title: form.title,
      description: form.description,
      category: form.category,
      product_category: form.productCategory || null,
      product_type: form.productType || null,
      size: form.size,
      brand: resolvedBrand?.display_name ?? '',
      condition: form.condition,
      colors: form.colors,
      shipping_size: form.shipping_size,
      price,
      photos: orderedUrls,
    }

    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        setLoading(false)
        return
      }
      router.push(`/listings/${data.id}`)
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-[#7fab87]/10 text-[#5a7a55] text-xs p-4">
        Estás publicando esta prenda a nombre de <strong>{sellerName}</strong>. Va a aparecer en el
        marketplace igual que si la hubiera publicado ella misma, y ella podrá editarla o pausarla
        después desde su propia cuenta.
      </div>

      {error && <p className="bg-red-50 text-red-600 text-xs p-3">{error}</p>}

      <section className="bg-white p-6 space-y-4">
        <h2 className="text-[10px] tracking-widest uppercase text-gray-400">Producto</h2>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Título</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} required
            placeholder="Ej: Vestido midi floral Zara"
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Descripción</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Departamento</label>
            <select value={form.category} onChange={e => set('category', e.target.value as CategoryValue)}
              className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              <option value="">Elegir…</option>
              {TAXONOMY.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Categoría</label>
            <select value={form.productCategory} onChange={e => set('productCategory', e.target.value)} disabled={!form.category}
              className="w-full border border-gray-200 px-3 py-2 text-sm bg-white disabled:opacity-50">
              <option value="">Elegir…</option>
              {productCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Tipo</label>
            <select value={form.productType} onChange={e => set('productType', e.target.value)} disabled={!form.productCategory}
              className="w-full border border-gray-200 px-3 py-2 text-sm bg-white disabled:opacity-50">
              <option value="">Elegir…</option>
              {productTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Talla</label>
            {sizeOptions.length > 0 ? (
              <select value={form.size} onChange={e => set('size', e.target.value)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
                <option value="">Elegir…</option>
                {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input value={form.size} onChange={e => set('size', e.target.value)}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
            )}
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Marca</label>
            <input value={brandInput} onChange={e => setBrandInput(e.target.value)} required
              list="admin-listing-brand-suggestions"
              placeholder="Ej: Zara, H&M, Mango... o Sin marca"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
            <datalist id="admin-listing-brand-suggestions">
              {brandOptions.map(b => <option key={b.id} value={b.display_name} />)}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Estado</label>
            <select value={form.condition} onChange={e => set('condition', e.target.value as typeof form.condition)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Tamaño de envío</label>
            <select value={form.shipping_size} onChange={e => set('shipping_size', e.target.value as typeof form.shipping_size)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              {SHIPPING_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Color (máx. {MAX_LISTING_COLORS})</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button type="button" key={c.value} onClick={() => toggleColor(c.value)}
                className={`w-7 h-7 rounded-full border ${form.colors.includes(c.value) ? 'ring-2 ring-offset-1 ring-black' : 'border-gray-200'}`}
                style={{ backgroundColor: c.hex === 'multi' || c.hex === 'transparent' ? '#fff' : c.hex }}
                title={c.label} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Precio (CLP)</label>
          <input type="number" min={1000} value={form.price} onChange={e => set('price', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Fotografías (hasta {MAX_PHOTOS})</label>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {photos.map((item, i) => (
              <PhotoThumb
                key={item.id}
                item={item}
                isCover={i === 0}
                canMoveLeft={i > 0}
                canMoveRight={i < photos.length - 1}
                onMove={dir => movePhoto(i, dir)}
                onRemove={() => removePhoto(item.id)}
                onEnhance={action => enhancePhoto(item.id, action)}
                onRevert={item.kind === 'new' && item.original ? () => revertPhoto(item.id) : undefined}
                onCrop={() => openCropModal(item.id)}
                enhancing={enhancingId === item.id}
                enhanceError={enhanceErrors[item.id]}
                menuOpen={menuOpenId === item.id}
                onToggleMenu={() => setMenuOpenId(prev => (prev === item.id ? null : item.id))}
              />
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-2xl hover:bg-gray-200 transition cursor-pointer">
                +
                <input type="file" accept="image/*" multiple onChange={e => handleFiles(e.target.files)} className="hidden" />
              </label>
            )}
          </div>
          {uploading && <p className="text-[10px] text-gray-400">Subiendo…</p>}

          {cropTargetId && (() => {
            const target = photos.find(p => p.id === cropTargetId)
            if (!target || target.kind !== 'new') return null
            return (
              <CropModal
                src={target.preview}
                onCancel={() => setCropTargetId(null)}
                onSave={area => applyCrop(cropTargetId, area)}
              />
            )
          })()}
        </div>
      </section>

      <button type="submit" disabled={loading || uploading}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 hover:bg-[#6f9678] transition disabled:opacity-50">
        {loading ? 'Publicando…' : `Publicar prenda para ${sellerName}`}
      </button>
    </form>
  )
}

function PhotoThumb({
  item, isCover, canMoveLeft, canMoveRight, onMove, onRemove, onEnhance, onRevert, onCrop,
  enhancing, enhanceError, menuOpen, onToggleMenu,
}: {
  item: PhotoItem
  isCover: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
  onEnhance: (action: PhotoEnhanceAction) => void
  onRevert?: () => void
  onCrop: () => void
  enhancing?: boolean
  enhanceError?: string
  menuOpen?: boolean
  onToggleMenu?: () => void
}) {
  const isEnhanced = item.kind === 'new' && !!item.original

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-square bg-gray-100">
        <Image src={item.kind === 'existing' ? item.url : item.preview} alt="" fill className="object-cover" />

        {isCover && (
          <span className="absolute top-1 left-1 bg-[#7fab87] text-white text-[8px] tracking-widest uppercase px-1.5 py-0.5">
            Portada
          </span>
        )}

        <button type="button" onClick={onRemove}
          className="absolute top-0 right-0 bg-black text-white text-xs w-5 h-5 flex items-center justify-center z-10">
          ×
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={onToggleMenu} />
            <div className="absolute bottom-7 left-0 right-0 bg-white shadow-lg border border-gray-200 z-30 overflow-hidden">
              {Object.entries(PHOTO_ENHANCE_ACTIONS).map(([key, { label }]) => (
                <button key={key} type="button"
                  onClick={() => onEnhance(key as PhotoEnhanceAction)}
                  className="block w-full text-left px-2 py-1.5 text-[9px] text-gray-700 hover:bg-gray-100 transition">
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="absolute bottom-1 left-1 right-1 flex gap-0.5 z-10">
          <button type="button" onClick={onCrop}
            className="flex-1 bg-black/70 text-white text-[8px] tracking-widest uppercase py-1 hover:bg-black transition">
            Editar
          </button>
          <button type="button" onClick={onToggleMenu} disabled={enhancing}
            className="flex-1 bg-black/70 text-white text-[8px] tracking-widest uppercase py-1 hover:bg-black transition disabled:opacity-60">
            {enhancing ? '...' : 'Mejorar ▾'}
          </button>
        </div>

        <div className="absolute top-0 left-0 right-0 flex justify-between px-0.5 pt-0.5">
          {canMoveLeft ? (
            <button type="button" onClick={() => onMove(-1)} className="bg-black/60 text-white text-[10px] w-4 h-4 flex items-center justify-center">‹</button>
          ) : <span />}
          {canMoveRight && (
            <button type="button" onClick={() => onMove(1)} className="bg-black/60 text-white text-[10px] w-4 h-4 flex items-center justify-center">›</button>
          )}
        </div>
      </div>

      {enhancing && <p className="text-[9px] text-gray-400 leading-tight">Puede tardar hasta un minuto…</p>}
      {isEnhanced && onRevert && (
        <button type="button" onClick={onRevert} className="text-[9px] text-[#5a7a55] underline underline-offset-2 text-left">
          ✓ Editada · Deshacer
        </button>
      )}
      {enhanceError && <p className="text-[9px] text-red-500 leading-tight">{enhanceError}</p>}
    </div>
  )
}
