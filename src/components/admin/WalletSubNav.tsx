import Link from 'next/link'

export default function WalletSubNav({ active }: { active: 'movimientos' | 'usuarias' | 'retiros' | 'referidos' }) {
  return (
    <div className="flex gap-4 mb-6">
      <Link
        href="/admin/wallet"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'movimientos' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Movimientos
      </Link>
      <Link
        href="/admin/wallet/balances"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'usuarias' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Saldos por usuaria
      </Link>
      <Link
        href="/admin/wallet/withdrawals"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'retiros' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Retiros
      </Link>
      <Link
        href="/admin/referrals"
        className={`text-[10px] tracking-widest uppercase pb-1 ${active === 'referidos' ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'}`}
      >
        Referidos
      </Link>
    </div>
  )
}
