import Link from 'next/link'

export default function WalletSubNav({ active }: { active: 'movimientos' | 'retiros' }) {
  return (
    <div className="flex gap-4 mb-6">
      <Link
        href="/admin/wallet"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'movimientos' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Movimientos
      </Link>
      <Link
        href="/admin/wallet/withdrawals"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'retiros' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Retiros
      </Link>
    </div>
  )
}
