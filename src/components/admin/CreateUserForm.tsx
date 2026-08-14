'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateUserForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error || 'Error al crear la cuenta')
      setSending(false)
      return
    }

    setSuccess(`Cuenta creada y correo de activación enviado a ${email.trim()}`)
    setName('')
    setEmail('')
    setPhone('')
    setSending(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] tracking-widest uppercase text-white bg-black px-3 py-2 hover:bg-gray-800 transition"
      >
        + Crear cuenta
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 space-y-3 mb-2 max-w-md">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-gray-400">Crear cuenta manual</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-black">
          Cancelar
        </button>
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        type="email"
        placeholder="Email"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <input
        value={phone}
        onChange={e => setPhone(e.target.value)}
        placeholder="Teléfono (opcional)"
        className="w-full border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-gray-400"
      />
      <button
        type="submit"
        disabled={sending}
        className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-2.5 hover:bg-[#6f9678] transition disabled:opacity-50"
      >
        {sending ? 'Creando...' : 'Crear cuenta y enviar correo de activación'}
      </button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      {success && <p className="text-[#5a7a55] text-xs">{success}</p>}
    </form>
  )
}
