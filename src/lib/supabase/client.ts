import { createBrowserClient } from '@supabase/ssr'

// flowType 'implicit' a propósito: @supabase/ssr usa PKCE por defecto, que
// entrega el link de "olvidé mi contraseña" como ?code=... — pero este
// proyecto no tiene ningún endpoint que intercambie ese code por una sesión,
// así que el reset se rompe en silencio. AuthHashHandler (ver ese archivo)
// ya sabe procesar el formato #access_token que entrega el flujo implícito,
// así que hay que forzar ese flujo en vez de construir un exchange de PKCE.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  )
}
