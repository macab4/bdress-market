import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Antes, la única señal de que había que despachar una venta pagada era
// entrar directo a /dashboard/sales — si la vendedora se logueaba y
// navegaba a cualquier otra parte del sitio, no había ningún aviso (ni acá
// ni en notifications/emails de forma persistente) de que le quedaba algo
// pendiente de enviar. Esta barra vive en el layout raíz para que aparezca
// en cualquier página mientras tenga al menos una venta en status='paid'.
export default async function PendingShipmentsBanner() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { count, error } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', user.id)
    .eq('status', 'paid')

  if (error) {
    console.error('Error al chequear ventas pendientes de despacho:', error.message)
    return null
  }
  if (!count) return null

  return (
    <Link
      href="/dashboard/sales"
      className="block bg-black text-white text-center py-2 px-4 text-[11px] sm:text-xs tracking-wide hover:bg-gray-800 transition"
    >
      {count === 1
        ? 'Tenés 1 venta pagada pendiente de despachar'
        : `Tenés ${count} ventas pagadas pendientes de despachar`} · Generar etiqueta →
    </Link>
  )
}
