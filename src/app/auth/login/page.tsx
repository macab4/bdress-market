'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNeedsConfirmation(false)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation(true)
      } else {
        setError('Email o contraseña incorrectos')
      }
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  async function handleResend() {
    setResendState('sending')
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
    setResendState('sent')
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8">
        <h1 className="text-2xl font-light tracking-widest text-center mb-8 uppercase">
          Bdress Market
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs tracking-widest uppercase text-gray-500">
                Contraseña
              </label>
              <Link href="/auth/forgot-password" className="text-[10px] text-gray-400 hover:text-black underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}

          {needsConfirmation && (
            <div className="bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-2">
              <p>Todavía no confirmaste tu correo. Revisá tu bandeja de entrada (y spam) para el link de confirmación.</p>
              {resendState === 'sent' ? (
                <p className="text-[#5a7a55]">Te reenviamos el correo de confirmación.</p>
              ) : (
                <button type="button" onClick={handleResend} disabled={resendState === 'sending'}
                  className="text-[#8DA988] underline disabled:opacity-50">
                  {resendState === 'sending' ? 'Enviando...' : 'Reenviar correo de confirmación'}
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white text-xs tracking-widest uppercase py-3 hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-[#8DA988] hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}
