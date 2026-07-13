'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import ComunaSelect from '@/components/ComunaSelect'

export default function EditProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: profile.name,
    city: profile.city ?? '',
    bio: profile.bio ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    comuna: profile.comuna ?? '',
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre no puede estar vacío'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    let avatar_url = profile.avatar_url

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop()
      const path = `avatars/${profile.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('listings')
        .upload(path, avatarFile, { contentType: avatarFile.type })

      if (uploadError) { setError('Error subiendo foto: ' + uploadError.message); setLoading(false); return }

      const { data: { publicUrl } } = supabase.storage.from('listings').getPublicUrl(path)
      avatar_url = publicUrl
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        name: form.name.trim(),
        city: form.city.trim() || null,
        bio: form.bio.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        comuna: form.comuna.trim() || null,
        avatar_url,
      })
      .eq('id', profile.id)

    if (updateError) { setError(updateError.message); setLoading(false); return }

    router.push(`/profile/${profile.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 space-y-6">
      {/* Avatar */}
      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-3">Foto de perfil</label>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-xl font-medium text-gray-500 overflow-hidden flex-shrink-0 relative hover:opacity-80 transition">
            {avatarPreview ? (
              <Image src={avatarPreview} alt="" fill className="object-cover" />
            ) : (
              form.name?.[0]?.toUpperCase() ?? '?'
            )}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="text-xs tracking-widest uppercase text-gray-500 hover:text-black underline">
            Cambiar foto
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>
      </div>

      {/* Nombre */}
      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
          Nombre para mostrar
        </label>
        <input value={form.name} onChange={e => set('name', e.target.value)} required
          placeholder="Como quieras que te vean otras usuarias"
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        <p className="text-[10px] text-gray-400 mt-1">
          No tiene que ser tu nombre real — es lo que verán las compradoras y vendedoras en Bdress.
        </p>
      </div>

      {/* Ciudad */}
      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Ciudad</label>
        <input value={form.city} onChange={e => set('city', e.target.value)}
          placeholder="Ej: Santiago"
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Sobre ti</label>
        <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
          rows={3} placeholder="Cuéntales algo a las compradoras sobre ti o tu estilo..."
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
      </div>

      {/* Dirección de despacho */}
      <div className="border-t border-gray-100 pt-6">
        <p className="text-xs tracking-widest uppercase text-gray-500 mb-1">Dirección de despacho</p>
        <p className="text-[10px] text-gray-400 mb-4">
          La usamos para generar las etiquetas de envío cuando vendas una prenda.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Teléfono</label>
            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="+56 9 1234 5678"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Dirección</label>
            <input value={form.address} onChange={e => set('address', e.target.value)}
              placeholder="Calle y número"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
          </div>

          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Comuna</label>
            <ComunaSelect value={form.comuna} onChange={v => set('comuna', v)}
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none bg-white" />
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button type="submit" disabled={loading}
        className="w-full bg-black text-white text-xs tracking-widest uppercase py-3 hover:bg-gray-800 transition disabled:opacity-50">
        {loading ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </form>
  )
}
