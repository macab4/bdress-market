import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin-auth'

// Link real que se manda por correo y se muestra en "Mis ventas" — a
// propósito no apunta directo al archivo en Storage, pasa por acá primero
// para poder registrar la primera vez que la vendedora efectivamente lo abre
// (order.label_downloaded_at). Redirige al archivo real después.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, seller_id, label_url, label_downloaded_at, international_status')
    .eq('id', id)
    .single()

  if (!order || !order.label_url) redirect('/dashboard/sales')

  const isInternational = order.international_status !== null
  const canView = order.seller_id === user.id || (isInternational && isAdminEmail(user.email))
  if (!canView) redirect('/dashboard/sales')

  if (!order.label_downloaded_at) {
    await admin.from('orders').update({ label_downloaded_at: new Date().toISOString() }).eq('id', id)
  }

  redirect(order.label_url)
}
