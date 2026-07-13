'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-md p-8 text-center">
          <p className="text-xs tracking-[6px] uppercase text-[#8DA988] mb-4">Listo</p>
          <h1 className="text-xl font-light tracking-widest uppercase mb-3">Revisa tu correo</h1>
          <p className="text-sm text-gray-500 mb-6">
            Si <span className="font-medium text-gray-700">{email}</span> tiene una cuenta en Bdress, te
            enviamos un link para crear una contraseña nueva.
          </p>
          <Link href="/auth/login" className="text-[#8DA988] text-xs underline">
            Volver a ingresar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8">
        <h1 className="text-xl font-light tracking-widest text-center mb-2 uppercase">
          Recuperar contraseña
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          Te enviamos un link para crear una contraseña nueva
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white text-xs tracking-widest uppercase py-3 hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/auth/login" className="text-[#8DA988] hover:underline">
            Volver a ingresar
          </Link>
        </p>
      </div>
    </div>
  )
}
