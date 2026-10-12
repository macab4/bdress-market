import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function CartOrderConfirmationPage({
  params,
}: {
  params: Promise<{ cartCheckoutId: string }>
}) {
  const { cartCheckoutId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, buyer_id, amount, shipping_cost, shipping_name, shipping_address, shipping_address_extra, shipping_comuna, shipping_city,
      listing:listings(title, photos),
      seller:profiles!orders_seller_id_fkey(name)
    `)
    .eq('cart_checkout_id', cartCheckoutId) as unknown as {
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
      }[] | null
    }

  if (!orders || orders.length === 0) notFound()
  if (orders[0].buyer_id !== user.id) notFound()

  const total = orders.reduce((sum, o) => sum + o.amount + o.shipping_cost, 0)
  const sellerNames = Array.from(new Set(orders.map(o => o.seller?.name).filter((n): n is string => !!n)))
  const first = orders[0]

  return (
    <div className="min-h-screen bg-[#EBEBEB] py-14 px-4">
      <div className="max-w-md mx-auto text-center">
        <CheckCircle2 size={40} className="mx-auto text-[#5a7a55] mb-4" strokeWidth={1.5} />
        <h1 className="text-xl font-light tracking-widest uppercase mb-2">¡Gracias por tu compra!</h1>
        <p className="text-sm text-gray-500 mb-8">
          Confirmamos tu pedido a {sellerNames.length === 1 ? sellerNames[0] : `${sellerNames.length} vendedoras distintas`}.
          Cada una te avisa por correo apenas despache su parte.
        </p>

        <div className="bg-white p-5 text-left mb-6 space-y-4">
          {orders.map(order => {
            const photo = order.listing?.photos?.[0]
            return (
              <div key={order.id} className="flex gap-4 items-center pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="w-16 h-20 bg-gray-100 relative flex-shrink-0 overflow-hidden">
                  {photo ? (
                    <Image src={photo} alt={order.listing?.title ?? ''} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin foto</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{order.listing?.title ?? 'Prenda'}</p>
                  <p className="text-[10px] text-gray-400">Vendedora: {order.seller?.name ?? '—'}</p>
                  <p className="text-sm font-semibold text-[#5a7a55] mt-0.5">${(order.amount + order.shipping_cost).toLocaleString('es-CL')}</p>
                </div>
              </div>
            )
          })}

          <div className="flex justify-between text-sm font-medium pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>${total.toLocaleString('es-CL')}</span>
          </div>

          <div className="pt-2">
            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-1.5">Se envía a</p>
            <p className="text-sm text-gray-700">{first.shipping_name}</p>
            <p className="text-xs text-gray-400">
              {first.shipping_address}
              {first.shipping_address_extra && `, ${first.shipping_address_extra}`}
            </p>
            <p className="text-xs text-gray-400">{first.shipping_comuna}, {first.shipping_city}</p>
          </div>
        </div>

        <p className="text-[11px] text-gray-400 mb-8">
          Bdress retiene tu pago hasta que confirmes que recibiste cada prenda — tu compra está protegida.
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
