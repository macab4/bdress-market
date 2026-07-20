'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, SIZES_BY_CATEGORY, CONDITIONS, COLORS, SHIPPING_SIZES, MAX_LISTING_COLORS, CategoryValue, sellerPayout, PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED } from '@/lib/catalog'
import { Listing } from '@/types'

type PhotoItem =
  | { id: string; kind: 'existing'; url: string }
  | { id: string; kind: 'new'; file: File; preview: string }

interface ListingPrefill {
  title: string
  category: CategoryValue
  subcategory: string
  size: string
  brand: string
  colors: string[]
  shipping_size: Listing['shipping_size']
}

interface ListingFormProps {
  listing?: Listing // presente = modo edición
  priceLocked?: boolean // hay una oferta pendiente — no se puede cambiar el precio
  prefill?: ListingPrefill // precarga desde una compra propia (revender) — nunca en modo edición
  originalPrice?: number // precio al que la compró, solo referencia visual
}

export default function ListingForm({ listing, priceLocked, prefill, originalPrice }: ListingFormProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    title: listing?.title ?? prefill?.title ?? '',
    description: listing?.description ?? '',
    category: (listing?.category ?? prefill?.category ?? '') as CategoryValue | '',
    subcategory: listing?.subcategory ?? prefill?.subcategory ?? '',
    size: listing?.size ?? prefill?.size ?? '',
    brand: listing?.brand ?? prefill?.brand ?? '',
    condition: listing?.condition ?? 'muy_bueno',
    colors: (listing?.colors ?? prefill?.colors ?? []) as string[],
    shipping_size: listing?.shipping_size ?? prefill?.shipping_size ?? 'mediano',
    price: listing ? String(listing.price) : '',
  })
  const [photos, setPhotos] = useState<PhotoItem[]>(
    (listing?.photos ?? []).map(url => ({ id: url, kind: 'existing', url }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalPhotos = photos.length

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setCategory(value: CategoryValue) {
    setForm(prev => ({ ...prev, category: value, subcategory: '', size: '' }))
  }

  function toggleColor(value: string) {
    setForm(prev => {
      if (prev.colors.includes(value)) {
        return { ...prev, colors: prev.colors.filter(c => c !== value) }
      }
      if (prev.colors.length >= MAX_LISTING_COLORS) return prev
      return { ...prev, colors: [...prev.colors, value] }
    })
  }

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
  }

  function removePhoto(id: string) {
    setPhotos(prev => prev.filter(p => p.id !== id))
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos(prev => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const updated = [...prev]
      ;[updated[index], updated[target]] = [updated[target], updated[index]]
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totalPhotos === 0) { setError('Agrega al menos una foto'); return }
    if (!form.category) { setError('Selecciona una categoría'); return }
    if (!form.subcategory) { setError('Selecciona una subcategoría'); return }
    if (form.colors.length === 0) { setError('Selecciona al menos un color'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }

    // Subir fotos nuevas a Supabase Storage, respetando el orden elegido
    const orderedUrls: string[] = []
    for (const item of photos) {
      if (item.kind === 'existing') { orderedUrls.push(item.url); continue }

      const ext = item.file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('listings')
        .upload(path, item.file, { contentType: item.file.type })

      if (uploadError) { setError('Error subiendo foto: ' + uploadError.message); setLoading(false); return }

      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
      orderedUrls.push(publicUrl)
    }

    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      subcategory: form.subcategory,
      size: form.size,
      brand: form.brand,
      condition: form.condition,
      colors: form.colors,
      shipping_size: form.shipping_size,
      price: parseInt(form.price),
      photos: orderedUrls,
    }

    if (listing) {
      const { error: updateError } = await supabase
        .from('listings')
        .update(payload)
        .eq('id', listing.id)

      if (updateError) { setError(updateError.message); setLoading(false); return }
      router.push(`/listings/${listing.id}`)
      router.refresh()
    } else {
      const { data, error: insertError } = await supabase
        .from('listings')
        .insert({ ...payload, seller_id: user.id, status: 'active' })
        .select()
        .single()

      if (insertError) { setError(insertError.message); setLoading(false); return }
      router.push(`/listings/${data.id}`)
    }
  }

  const sizeOptions = form.category ? SIZES_BY_CATEGORY[form.category] : []
  const subcategoryOptions = CATEGORIES.find(c => c.value === form.category)?.subcategories ?? []

  return (
    <div className="min-h-screen bg-[#EBEBEB] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-light tracking-widest uppercase mb-8 text-center">
          {listing ? 'Editar prenda' : 'Publicar prenda'}
        </h1>

        {prefill && (
          <p className="bg-[#7fab87]/10 text-[#5a7a55] text-xs px-4 py-3 mb-4 leading-relaxed">
            Precargamos marca, talla, color y categoría de tu compra
            {originalPrice ? ` (la compraste en $${originalPrice.toLocaleString('es-CL')})` : ''}.
            Sube fotos reales de tu prenda y revisa el estado y el precio — ahora son tuyos.
          </p>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-6 space-y-6">

          {/* Fotos */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-3">
              Fotos (hasta 5)
            </label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {photos.map((item, i) => (
                <div key={item.id} className="relative aspect-square bg-gray-100 group">
                  <Image src={item.kind === 'existing' ? item.url : item.preview} alt="" fill className="object-cover" />

                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-[#7fab87] text-white text-[8px] tracking-widest uppercase px-1.5 py-0.5">
                      Portada
                    </span>
                  )}

                  <button type="button" onClick={() => removePhoto(item.id)}
                    className="absolute top-0 right-0 bg-black text-white text-xs w-5 h-5 flex items-center justify-center">
                    ×
                  </button>

                  <div className="absolute bottom-0 inset-x-0 flex justify-between px-0.5 pb-0.5">
                    <button type="button" onClick={() => movePhoto(i, -1)} disabled={i === 0}
                      aria-label="Mover a la izquierda"
                      className="bg-black/60 text-white w-5 h-5 flex items-center justify-center text-xs disabled:opacity-0">
                      ‹
                    </button>
                    <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1}
                      aria-label="Mover a la derecha"
                      className="bg-black/60 text-white w-5 h-5 flex items-center justify-center text-xs disabled:opacity-0">
                      ›
                    </button>
                  </div>
                </div>
              ))}
              {totalPhotos < 5 && (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-2xl hover:bg-gray-200 transition">
                  +
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} className="hidden" />
            <p className="text-[10px] text-gray-400">Usa las flechas para reordenar. La primera foto es la portada.</p>
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-2">Categoría</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button" onClick={() => setCategory(c.value)}
                  className={`text-sm py-2 border transition ${
                    form.category === c.value
                      ? 'border-[#7fab87] bg-[#7fab87] text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subcategoría */}
          {form.category && (
            <div>
              <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Subcategoría</label>
              <select value={form.subcategory} onChange={e => set('subcategory', e.target.value)} required
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white">
                <option value="">Selecciona</option>
                {subcategoryOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Título</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              placeholder="Ej: Vestido midi floral Zara"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          {/* Marca */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Marca</label>
            <input value={form.brand} onChange={e => set('brand', e.target.value)}
              placeholder="Ej: Zara, H&M, Mango..."
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          {/* Talla */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Talla</label>
            <select value={form.size} onChange={e => set('size', e.target.value)} required
              disabled={!form.category}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white disabled:bg-gray-50 disabled:text-gray-300">
              <option value="">{form.category ? 'Selecciona' : 'Primero elige una categoría'}</option>
              {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-2">Estado</label>
            <div className="space-y-2">
              {CONDITIONS.map(c => (
                <label key={c.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition ${
                    form.condition === c.value ? 'border-[#7fab87]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="condition" value={c.value}
                    checked={form.condition === c.value}
                    onChange={e => set('condition', e.target.value as typeof form.condition)}
                    className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">{c.label}</span>
                    <span className="block text-xs text-gray-400 mt-0.5">{c.description}</span>
                    {'sellerHint' in c && (
                      <span className="block text-xs text-amber-600 mt-0.5">{c.sellerHint}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-2">
              Color <span className="normal-case text-gray-400">(hasta {MAX_LISTING_COLORS})</span>
            </label>
            <div className="grid grid-cols-6 gap-3">
              {COLORS.map(c => {
                const selected = form.colors.includes(c.value)
                const disabled = !selected && form.colors.length >= MAX_LISTING_COLORS
                return (
                  <button key={c.value} type="button" onClick={() => toggleColor(c.value)} disabled={disabled}
                    className="flex flex-col items-center gap-1 group disabled:opacity-30" aria-pressed={selected}>
                    <span
                      className={`w-8 h-8 rounded-full border transition ${
                        selected ? 'ring-2 ring-offset-2 ring-black' : 'border-gray-200 group-hover:border-gray-400'
                      } ${c.value === 'blanco' || c.value === 'transparente' ? 'border-gray-300' : ''}`}
                      style={c.value === 'varios'
                        ? { background: 'conic-gradient(from 0deg, #C0392B, #F5A623, #F5E050, #4C9A4A, #2166B8, #6C2C8C, #C0392B)' }
                        : { backgroundColor: c.hex }}
                    />
                    <span className="text-[9px] text-gray-400 text-center leading-tight">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Describe el tejido, el largo, el corte, si tiene algún detalle especial..."
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
          </div>

          {/* Precio */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
              Precio (CLP)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
              <input type="number" value={form.price} onChange={e => set('price', e.target.value)}
                required min="1000" placeholder="25000" disabled={priceLocked}
                className="w-full border border-gray-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            {priceLocked && (
              <p className="text-[10px] text-amber-600 mt-1">
                Tienes una oferta esperando respuesta en esta prenda — resuélvela desde{' '}
                <a href="/dashboard/offers" className="underline">Mis ofertas</a> antes de cambiar el precio.
              </p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              Publicar y vender es gratis — no te cobramos comisión. Solo se descuenta el costo de
              procesamiento del pago ({Math.round(PROCESSING_FEE_PCT * 100)}% + ${PROCESSING_FEE_FIXED}).
              {form.price && ` Recibirás $${sellerPayout(parseInt(form.price)).toLocaleString('es-CL')}.`}
            </p>
          </div>

          {/* Tamaño de envío */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-2">Tamaño de envío</label>
            <div className="space-y-2">
              {SHIPPING_SIZES.map(s => (
                <label key={s.value}
                  className={`flex items-start gap-3 p-3 border cursor-pointer transition ${
                    form.shipping_size === s.value ? 'border-[#7fab87]' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="shipping_size" value={s.value}
                    checked={form.shipping_size === s.value}
                    onChange={e => set('shipping_size', e.target.value as typeof form.shipping_size)}
                    className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">
                      {s.label}
                      {'recommended' in s && s.recommended && (
                        <span className="ml-2 text-[9px] tracking-widest uppercase bg-[#7fab87]/10 text-[#5a7a55] px-1.5 py-0.5">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-400 mt-0.5">{s.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition disabled:opacity-50">
            {loading ? (listing ? 'Guardando...' : 'Publicando...') : (listing ? 'Guardar cambios' : 'Publicar prenda')}
          </button>
        </form>
      </div>
    </div>
  )
}
