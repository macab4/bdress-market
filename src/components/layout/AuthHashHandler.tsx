'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Los magic links y recovery links de Supabase no siempre respetan el
// redirectTo que le pedimos (depende de la lista de URLs permitidas en el
// dashboard de Supabase) — a veces caen en la portada u otra página con el
// token en el hash (#access_token=...), invisible para el servidor. Este
// componente vive en el layout raíz para procesarlo caiga donde caiga.
export default function AuthHashHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return
    const params = new URLSearchParams(window.location.hash.slice(1))
    const type = params.get('type')
    const supabase = createClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return
      history.replaceState(null, '', window.location.pathname + window.location.search)
      if (type === 'recovery') {
        router.push('/auth/reset-password')
      } else {
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  return null
}
