import { ShieldCheck } from 'lucide-react'
import { buyerProtectionFee, COMMISSION_PCT } from '@/lib/catalog'

interface Props {
  price: number
  size?: 'sm' | 'lg'
}

const SIZES = {
  sm: { text: 'text-sm', badge: 'text-[10px]', icon: 13 },
  lg: { text: 'text-2xl', badge: 'text-xs', icon: 18 },
}

export default function ProtectedPrice({ price, size = 'sm' }: Props) {
  const total = price + buyerProtectionFee(price)
  const s = SIZES[size]

  return (
    <p className={`${s.text} font-semibold text-[#5a7a55] flex items-center gap-1`}>
      ${total.toLocaleString('es-CL')}
      <span className={`${s.badge} font-normal`}>incl.</span>
      <span className="group/protection relative inline-flex">
        <ShieldCheck size={s.icon} className="text-[#8DA988] cursor-help" />
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded bg-black px-2.5 py-1.5 text-center text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 transition-opacity group-hover/protection:opacity-100"
        >
          Incluye el {Math.round(COMMISSION_PCT * 100)}% de Protección BDress, que cubre a la compradora ante cualquier problema con la prenda.
        </span>
      </span>
    </p>
  )
}
