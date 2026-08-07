'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function describeHashError(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const code = params.get('error_code')
  if (code === 'otp_expired') return 'Este link ya expiró.'
  return 'Este link ya no es válido — puede que ya lo hayas usado antes.'
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'invalid'>('checking')
  const [invalidReason, setInvalidReason] = useState('')

  useEffect(() => {
    const supabase = createClient()

    // Un link de recuperación vencido o ya usado (ej. clickeado dos veces desde
    // el mismo correo, o abierto después de que expiró) hace que Supabase
    // redirija acá con #error=... en vez de #access_token=... — sin este
    // chequeo, el formulario se mostraba igual y recién fallaba al guardar
    // con un "Auth session missing!" que no le explica nada a la usuaria.
    if (window.location.hash.includes('error=')) {
      const reason = describeHashError(window.location.hash)
      queueMicrotask(() => {
        setInvalidReason(reason)
        setSessionState('invalid')
      })
      return
    }

    // Si venía #access_token en el hash, AuthHashHandler (montado en el layout)
    // ya está procesándolo y llamando a setSession() en paralelo — escuchamos
    // el evento en vez de chequear el estado una sola vez, para no pisarle la
    // carrera con una lectura prematura.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSessionState('ready')
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSessionState('ready'); return }
      if (!window.location.hash.includes('access_token')) {
        setInvalidReason('No encontramos un link de recuperación válido.')
        setSessionState('invalid')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md p-8">
        <h1 className="text-xl font-light tracking-widest text-center mb-2 uppercase">
          Nueva contraseña
        </h1>

        {sessionState === 'invalid' ? (
          <div className="text-center">
            <p className="text-sm text-gray-500 mt-4 mb-6">{invalidReason} Pide un link nuevo para continuar.</p>
            <Link
              href="/auth/forgot-password"
              className="inline-block bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 px-6 hover:bg-[#6f9678] transition"
            >
              Pedir link nuevo
            </Link>
          </div>
        ) : sessionState === 'checking' ? (
          <p className="text-center text-sm text-gray-400 mt-6">Verificando tu link...</p>
        ) : (
          <>
            <p className="text-center text-sm text-gray-500 mb-8">
              Elige una contraseña nueva para tu cuenta
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
                  Contraseña nueva
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs tracking-widest uppercase text-gray-500 mb-1">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                />
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
