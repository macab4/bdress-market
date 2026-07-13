import { createClient } from '@supabase/supabase-js'

// Cliente con permisos elevados — bypasea RLS. Solo usar server-side
// (webhooks, endpoints sin sesión de usuario, o el dashboard de admin
// después de verificar que quien pide los datos es realmente la admin).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
