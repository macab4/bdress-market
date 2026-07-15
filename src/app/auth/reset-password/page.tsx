'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      </div>
    </div>
  )
}
