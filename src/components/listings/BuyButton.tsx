import Link from 'next/link'

interface BuyButtonProps {
  listingId: string
  price: number
}

export default function BuyButton({ listingId, price }: BuyButtonProps) {
  return (
    <div className="space-y-2">
      <Link
        href={`/listings/${listingId}/checkout`}
        className="block w-full bg-[#7fab87] text-white text-xs tracking-widest uppercase py-4 text-center hover:bg-[#6f9678] transition"
      >
        Comprar — ${price.toLocaleString('es-CL')}
      </Link>
      <p className="text-[10px] text-gray-400 text-center">
        Pago seguro vía Mercado Pago · Bdress retiene hasta confirmar recepción
      </p>
    </div>
  )
}
