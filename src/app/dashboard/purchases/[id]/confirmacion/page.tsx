import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, buyer_id, amount, shipping_cost, shipping_name, shipping_address, shipping_address_extra, shipping_comuna, shipping_city,
      listing:listings(title, photos),
      seller:profiles!orders_seller_id_fkey(name)
    `)
    .eq('id', id)
    .single() as unknown as {
      data: {
        id: string
        buyer_id: string
        amount: number
        shipping_cost: number
        shipping_name: string
        shipping_address: string
        shipping_address_extra: string
        shipping_comuna: string
        shipping_city: string
        listing: { title: string; photos: string[] } | null
        seller: { name: string } | null
      } | null
    }

  if (!order) notFound()
  if (order.buyer_id !== user.id) notFound()

  const photo = order.listing?.photos?.[0]
  const total = order.amount + order.shipping_cost

  return (
    <div className="min-h-screen bg-[#EBEBEB] py-14 px-4">
      <div className="max-w-md mx-auto text-center">
        <CheckCircle2 size={40} className="mx-auto text-[#5a7a55] mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-light tracking-widest uppercase mb-2">¡Gracias por tu compra!</h1>
        <p className="text-sm text-gray-500 mb-8">
          Confirmamos tu pedido a {order.seller?.name ?? 'la vendedora'}. Te vamos a avisar por correo apenas lo despache.
        </p>

        <div className="bg-white p-5 text-left mb-6">
          <div className="flex gap-4 items-center pb-4 border-b border-gray-100">
            <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
              {photo ? (
                <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{order.listing?.title ?? 'Prenda'}</p>
              <p className="text-sm font-semibold text-[#5a7a55] mt-0.5">${total.toLocaleString('es-CL')}</p>
            </div>
          </div>

          <div className="pt-4">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Se envía a</p>
            <p className="text-sm text-gray-700">{order.shipping_name}</p>
            <p className="text-xs text-gray-400">
              {order.shipping_address}
              {order.shipping_address_extra && `, ${order.shipping_address_extra}`}
            </p>
            <p className="text-xs text-gray-400">{order.shipping_comuna}, {order.shipping_city}</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 mb-8">
          Bdress retiene tu pago hasta que confirmes que recibiste la prenda — tu compra está protegida.
        </p>

        <div className="space-y-2">
          <Link href="/dashboard/purchases"
            className="block w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-3 hover:bg-[#6f9678] transition">
            Ver mis compras
          </Link>
          <Link href="/"
            className="block w-full text-xs tracking-widest uppercase text-gray-500 hover:text-black border border-gray-200 py-3 transition">
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  )
}
