import { buyerProtectionFee } from '@/lib/catalog'
import BuyerProtectionModal from './BuyerProtectionModal'

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
      <BuyerProtectionModal iconSize={s.icon} />
    </p>
  )
}
