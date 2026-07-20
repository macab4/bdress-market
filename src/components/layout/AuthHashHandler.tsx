'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Los magic links y recovery links que genera la API de administrador
// (invitación de vendedoras migradas, "olvidé mi clave") llegan con el token
// en el hash de la URL (#access_token=...) en formato implícito. Nuestro
// cliente está configurado en modo PKCE (default de @supabase/ssr), que
// rechaza en silencio ese formato — por eso nunca dejaba a nadie adentro.
// Acá lo procesamos a mano con setSession(), que no depende del flujo.
export default function AuthHashHandler() {
  useEffect(() => {
    if (!window.location.hash.includes('access_token')) return
    const params = new URLSearchParams(window.location.hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')
    if (!access_token || !refresh_token) return

    const supabase = createClient()
    supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
      if (error || !data.session) return
      // router.refresh() no alcanza a reflejar la cookie recién escrita en los
      // Server Components (Navbar incluido) — forzamos una recarga real.
      const cleanPath = window.location.pathname + window.location.search
      window.location.href = type === 'recovery' ? '/auth/reset-password' : cleanPath
    })
  }, [])

  return null
}
