'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', comment: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Error al enviar el mensaje')
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-white p-8 text-center">
        <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-3">Listo</p>
        <p className="text-sm text-gray-600">Recibimos tu mensaje. Te vamos a responder a la brevedad.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Nombre</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
        <div>
          <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Correo electrónico *</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
            className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
        </div>
      </div>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Número de teléfono</label>
        <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
      </div>

      <div>
        <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">Comentario</label>
        <textarea value={form.comment} onChange={e => set('comment', e.target.value)} required
          rows={5}
          className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <button type="submit" disabled={loading}
        className="bg-[#7fab87] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#6f9678] transition disabled:opacity-50">
        {loading ? 'Enviando...' : 'Enviar'}
      </button>
    </form>
  )
}
