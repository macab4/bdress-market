'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', city: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, city: form.city } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      // El proyecto requiere confirmar el email antes de poder ingresar
      setSubmitted(true)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleResend() {
    setResendState('sending')
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email: form.email })
    setResendState('sent')
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
        <div className="bg-white w-full max-w-md p-8 text-center">
          <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-4">Ya casi</p>
          <h1 className="text-xl font-light tracking-widest uppercase mb-3">Revisa tu correo</h1>
          <p className="text-sm text-gray-500 mb-6">
            Te enviamos un email a <span className="font-medium text-gray-700">{form.email}</span> para
            confirmar tu cuenta. Abre ese correo y haz clic en el link antes de poder ingresar a Bdress.
          </p>

          {resendState === 'sent' ? (
            <p className="text-[#5a7a55] text-xs mb-4">Te reenviamos el correo de confirmación.</p>
          ) : (
            <button type="button" onClick={handleResend} disabled={resendState === 'sending'}
              className="text-xs text-gray-400 underline hover:text-black disabled:opacity-50 mb-4 block mx-auto">
              {resendState === 'sending' ? 'Enviando...' : '¿No te llegó? Reenviar correo'}
            </button>
          )}

          <Link href="/auth/login" className="text-[#7fab87] text-xs underline">
            Ya confirmé mi correo, ir a ingresar
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8">
        <h1 className="text-2xl font-light tracking-widest text-center mb-2 uppercase">
          Bdress Market
        </h1>
        <p className="text-center text-sm text-gray-500 mb-8">
          Crea tu cuenta y empieza a vender
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
              Nombre visible
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              required
              placeholder="Como quieras que te vean otras usuarias"
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              No tiene que ser tu nombre real — puedes cambiarlo después desde tu perfil.
            </p>
          </div>

          {[
            { label: 'Email', field: 'email', type: 'email' },
            { label: 'Contraseña', field: 'password', type: 'password' },
            { label: 'Ciudad', field: 'city', type: 'text' },
          ].map(({ label, field, type }) => (
            <div key={field}>
              <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
                {label}
              </label>
              <input
                type={type}
                value={form[field as keyof typeof form]}
                onChange={e => set(field, e.target.value)}
                required={field !== 'city'}
                className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
          ))}

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/auth/login" className="text-[#7fab87] hover:underline">
            Ingresar
          </Link>
        </p>
      </div>
    </div>
  )
}
