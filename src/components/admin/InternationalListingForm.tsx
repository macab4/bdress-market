'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'
import {
  CONDITIONS, COLORS, SHIPPING_SIZES, MAX_LISTING_COLORS, CategoryValue,
  sizeOptionsFor, TAXONOMY,
} from '@/lib/catalog'
import { INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS, INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS } from '@/lib/international/content'
import { Listing, ListingSourcing } from '@/types'

interface InternationalListingFormProps {
  listing?: Listing
  sourcing?: ListingSourcing
}

// Herramienta interna para la admin — a diferencia de ListingForm.tsx
// (usado por vendedoras), acá se prioriza velocidad de carga sobre un
// editor de fotos con recorte/drag-and-drop completo: solo subir, previsualizar
// y reordenar con flechas.
export default function InternationalListingForm({ listing, sourcing }: InternationalListingFormProps) {
  const router = useRouter()
  const isEdit = !!listing

  const [form, setForm] = useState({
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    category: (listing?.category ?? '') as CategoryValue | '',
    productCategory: listing?.product_category ?? '',
    productType: listing?.product_type ?? '',
    size: listing?.size ?? '',
    brand: listing?.brand ?? '',
    condition: listing?.condition ?? 'nuevo_con_etiquetas',
    colors: (listing?.colors ?? []) as string[],
    shipping_size: listing?.shipping_size ?? 'mediano',
    price: listing ? String(listing.price) : '',
    international_lead_time_min_days: String(listing?.international_lead_time_min_days ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS),
    international_lead_time_max_days: String(listing?.international_lead_time_max_days ?? INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS),
    international_shipping_notes: listing?.international_shipping_notes ?? '',
    source_platform: sourcing?.source_platform ?? 'vinted',
    source_url: sourcing?.source_url ?? '',
    source_listing_id: sourcing?.source_listing_id ?? '',
    source_original_price: sourcing?.source_original_price != null ? String(sourcing.source_original_price) : '',
    source_original_currency: sourcing?.source_original_currency ?? 'EUR',
    source_status: sourcing?.source_status ?? 'pending_verification',
    international_cost_estimate: sourcing?.international_cost_estimate != null ? String(sourcing.international_cost_estimate) : '',
    international_customs_estimate: sourcing?.international_customs_estimate != null ? String(sourcing.international_customs_estimate) : '',
    international_internal_notes: sourcing?.international_internal_notes ?? '',
    external_seller_name: sourcing?.external_seller_name ?? '',
    external_location: sourcing?.external_location ?? '',
  })
  const [photos, setPhotos] = useState<string[]>(listing?.photos ?? [])
  const [uploading, setUploading] = useState(false)
  const [authorizationConfirmed, setAuthorizationConfirmed] = useState(false)
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
    setUploading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión expirada')

      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file)
        const ext = compressed.name.split('.').pop() || 'jpg'
        const path = `${user.id}/international-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('listings').upload(path, compressed, { contentType: compressed.type })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
        uploaded.push(publicUrl)
      }
      setPhotos(prev => [...prev, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo fotos')
    } finally {
      setUploading(false)
    }
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos(prev => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const productCategories = TAXONOMY.find(d => d.value === form.category)?.productCategories ?? []
  const productTypes = productCategories.find(c => c.value === form.productCategory)?.types ?? []
  const sizeOptions = form.category && form.productCategory ? sizeOptionsFor(form.category, form.productCategory) : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim() || !form.category || !form.size || !form.brand.trim()) {
      setError('Completa título, categoría, talla y marca')
      return
    }
    const price = Number(form.price)
    if (!price || price <= 0) {
      setError('Ingresa un precio final válido')
      return
    }
    if (photos.length === 0) {
      setError('Agrega al menos una fotografía')
      return
    }
    if (!isEdit && !authorizationConfirmed) {
      setError('Confirma que Bdress cuenta con autorización para usar estas imágenes y esta información')
      return
    }

    setLoading(true)
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      product_category: form.productCategory || null,
      product_type: form.productType || null,
      size: form.size,
      brand: form.brand,
      condition: form.condition,
      colors: form.colors,
      shipping_size: form.shipping_size,
      price,
      photos,
      international_lead_time_min_days: Number(form.international_lead_time_min_days) || INTERNATIONAL_DEFAULT_LEAD_TIME_MIN_DAYS,
      international_lead_time_max_days: Number(form.international_lead_time_max_days) || INTERNATIONAL_DEFAULT_LEAD_TIME_MAX_DAYS,
      international_shipping_notes: form.international_shipping_notes || null,
      source_platform: form.source_platform,
      source_url: form.source_url || null,
      source_listing_id: form.source_listing_id || null,
      source_original_price: form.source_original_price ? Number(form.source_original_price) : null,
      source_original_currency: form.source_original_currency || null,
      source_status: form.source_status,
      international_cost_estimate: form.international_cost_estimate ? Number(form.international_cost_estimate) : null,
      international_customs_estimate: form.international_customs_estimate ? Number(form.international_customs_estimate) : null,
      international_internal_notes: form.international_internal_notes || null,
      external_seller_name: form.external_seller_name || null,
      external_location: form.external_location || null,
      content_authorization_confirmed: authorizationConfirmed || isEdit,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/admin/international/listings/${listing!.id}` : '/api/admin/international/listings',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al guardar')
        setLoading(false)
        return
      }
      router.push('/admin/international')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <p className="bg-red-50 text-red-600 text-xs p-3">{error}</p>}

      {/* Producto */}
      <section className="bg-white p-6 space-y-4">
        <h2 className="text-[10px] tracking-widest uppercase text-gray-400">Producto</h2>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Título</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} required
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
            <input value={form.brand} onChange={e => set('brand', e.target.value)} required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
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
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Precio final en Bdress (CLP)</label>
          <input type="number" min={1} value={form.price} onChange={e => set('price', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          <p className="text-[10px] text-gray-400 mt-1">Precio visible para la clienta — nunca se muestra el precio original ni los costos.</p>
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Fotografías</label>
          <div className="flex flex-wrap gap-3 mb-3">
            {photos.map((url, i) => (
              <div key={url} className="relative w-20 h-24 bg-gray-100 overflow-hidden">
                <Image src={url} alt="" fill className="object-cover" />
                <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-black/50 text-white text-[10px]">
                  <button type="button" onClick={() => movePhoto(i, -1)} className="px-1.5 py-0.5">‹</button>
                  <button type="button" onClick={() => removePhoto(i)} className="px-1.5 py-0.5">✕</button>
                  <button type="button" onClick={() => movePhoto(i, 1)} className="px-1.5 py-0.5">›</button>
                </div>
              </div>
            ))}
          </div>
          <input type="file" accept="image/*" multiple disabled={uploading} onChange={e => handleFiles(e.target.files)} className="text-xs" />
          {uploading && <p className="text-[10px] text-gray-400 mt-1">Subiendo…</p>}
        </div>
      </section>

      {/* Origen y disponibilidad */}
      <section className="bg-white p-6 space-y-4">
        <h2 className="text-[10px] tracking-widest uppercase text-gray-400">Origen y disponibilidad</h2>
        <p className="text-[10px] text-gray-400 -mt-2">
          Estos campos son internos — la clienta nunca ve la plataforma de origen, la URL ni los costos.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Plataforma de origen</label>
            <select value={form.source_platform} onChange={e => set('source_platform', e.target.value as typeof form.source_platform)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              <option value="vinted">Vinted</option>
              <option value="manual">Manual</option>
              <option value="other">Otra</option>
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Estado de disponibilidad</label>
            <select value={form.source_status} onChange={e => set('source_status', e.target.value as typeof form.source_status)} className="w-full border border-gray-200 px-3 py-2 text-sm bg-white">
              <option value="available">Disponible</option>
              <option value="pending_verification">Por comprobar</option>
              <option value="purchased">Comprada</option>
              <option value="unavailable">No disponible</option>
            </select>
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Identificador externo</label>
            <input value={form.source_listing_id} onChange={e => set('source_listing_id', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">URL de la publicación original</label>
          <input type="url" value={form.source_url} onChange={e => set('source_url', e.target.value)}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Precio original</label>
            <input type="number" value={form.source_original_price} onChange={e => set('source_original_price', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Moneda original</label>
            <input value={form.source_original_currency} onChange={e => set('source_original_currency', e.target.value)} placeholder="EUR"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Plazo mínimo estimado (días)</label>
            <input type="number" value={form.international_lead_time_min_days} onChange={e => set('international_lead_time_min_days', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Plazo máximo estimado (días)</label>
            <input type="number" value={form.international_lead_time_max_days} onChange={e => set('international_lead_time_max_days', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 -mt-2">Valor recomendado: 20 a 30 días corridos. Nunca se promete una fecha exacta.</p>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Notas de envío (visibles para la clienta)</label>
          <textarea value={form.international_shipping_notes} onChange={e => set('international_shipping_notes', e.target.value)} rows={2}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Costo internacional estimado (CLP)</label>
            <input type="number" value={form.international_cost_estimate} onChange={e => set('international_cost_estimate', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Costo aduanero estimado (CLP)</label>
            <input type="number" value={form.international_customs_estimate} onChange={e => set('international_customs_estimate', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Vendedora / referencia externa</label>
            <input value={form.external_seller_name} onChange={e => set('external_seller_name', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Ubicación original</label>
            <input value={form.external_location} onChange={e => set('external_location', e.target.value)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Notas internas</label>
          <textarea value={form.international_internal_notes} onChange={e => set('international_internal_notes', e.target.value)} rows={3}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </section>

      {!isEdit && (
        <label className="flex items-start gap-2 bg-white p-4 text-xs text-gray-600">
          <input type="checkbox" checked={authorizationConfirmed} onChange={e => setAuthorizationConfirmed(e.target.checked)} className="mt-0.5" />
          Confirmo que Bdress cuenta con autorización o base suficiente para utilizar estas imágenes y esta información.
        </label>
      )}

      <button type="submit" disabled={loading || uploading}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 hover:bg-[#6f9678] transition disabled:opacity-50">
        {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Publicar producto internacional'}
      </button>
    </form>
  )
}
