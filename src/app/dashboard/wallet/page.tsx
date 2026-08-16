import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { WalletAccount, WalletTransaction, Withdrawal } from '@/types'
import { WALLET_TRANSACTION_TYPE_LABELS as TYPE_LABELS } from '@/lib/wallet'

const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente de revisión',
  processing: 'En proceso',
}

function formatCLP(n: number) {
  return `$${Math.abs(n).toLocaleString('es-CL')}`
}

// Cada tipo de movimiento mueve un delta distinto — mostrar el que
// realmente representa "lo que le pasó a la usuaria" en esa fila (ej. una
// venta liberada mueve pending_delta negativo Y available_delta positivo a
// la vez; lo relevante para la usuaria es que recibió plata disponible, no
// que se descontó de "pendiente").
function movementAmount(tx: WalletTransaction): number {
  switch (tx.type) {
    case 'sale_pending':
    case 'sale_reversal':
      return tx.pending_delta
    case 'withdrawal_completed':
      return tx.reserved_delta
    default:
      return tx.available_delta
  }
}

export default async function WalletPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: account }, { data: movements }, { data: activeWithdrawal }] = await Promise.all([
    supabase.from('wallet_accounts').select('*').eq('user_id', user.id).maybeSingle() as unknown as Promise<{ data: WalletAccount | null }>,
    supabase
      .from('wallet_transactions')
      .select('*, listing:listings(title, photos)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100) as unknown as Promise<{ data: WalletTransaction[] | null }>,
    supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .maybeSingle() as unknown as Promise<{ data: Withdrawal | null }>,
  ])

  const available = account?.available_balance ?? 0
  const pending = account?.pending_balance ?? 0
  const reserved = account?.reserved_balance ?? 0

  // reserved_balance es compartido entre retiros en curso (withdrawal_hold)
  // y saldo aplicado a compras aún no confirmadas (marketplace_purchase_hold,
  // fase 3) — sin distinguirlos, una compradora que abandonó un checkout
  // veía su propio saldo atrapado etiquetado como "retiro en curso", algo
  // que nunca pidió. Como solo puede haber un retiro activo a la vez, el
  // resto del reservado (si lo hay) es necesariamente de compras pendientes.
  const reservedForWithdrawal = activeWithdrawal?.amount ?? 0
  const reservedForPurchase = Math.max(0, reserved - reservedForWithdrawal)

  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <h1 className="text-xl font-light tracking-widest uppercase">Mi saldo</h1>

        <div className="bg-black text-white p-6">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Saldo B-Dress</p>
          <p className="text-3xl font-light">{formatCLP(available)}</p>
          <div className="flex flex-wrap gap-x-4 mt-2">
            {pending > 0 && (
              <p className="text-xs text-gray-400">Pendiente de liberar: {formatCLP(pending)}</p>
            )}
            {reservedForWithdrawal > 0 && (
              <p className="text-xs text-gray-400">Retiro en curso: {formatCLP(reservedForWithdrawal)}</p>
            )}
            {reservedForPurchase > 0 && (
              <p className="text-xs text-gray-400">Reservado para una compra en proceso: {formatCLP(reservedForPurchase)}</p>
            )}
          </div>
          {reservedForPurchase > 0 && (
            <p className="text-[10px] text-gray-500 mt-1">
              Se libera solo automáticamente si no completas esa compra.
            </p>
          )}

          {activeWithdrawal ? (
            <div className="mt-4 bg-white/10 px-4 py-3">
              <p className="text-xs">
                Tienes un retiro de <strong>{formatCLP(activeWithdrawal.amount)}</strong> — {WITHDRAWAL_STATUS_LABELS[activeWithdrawal.status] ?? activeWithdrawal.status}
              </p>
            </div>
          ) : (
            <Link
              href="/dashboard/wallet/withdraw"
              className="inline-block mt-4 bg-white text-black text-[10px] tracking-widest uppercase px-4 py-2.5 hover:bg-gray-100 transition"
            >
              Transferir
            </Link>
          )}
        </div>

        <Link href="/dashboard/wallet/bank-accounts" className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black">
          Mis cuentas bancarias
        </Link>

        <section className="bg-white p-5">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-4">Tus movimientos</p>
          {movements && movements.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {movements.map(tx => {
                const amount = movementAmount(tx)
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      {tx.listing ? (
                        <Link href={`/listings/${tx.listing_id}`} className="text-sm font-medium truncate hover:underline block">
                          {tx.listing.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium truncate">{tx.description || TYPE_LABELS[tx.type]}</p>
                      )}
                      <p className="text-[10px] tracking-widest uppercase text-gray-400 mt-0.5">
                        {TYPE_LABELS[tx.type]} · {new Date(tx.created_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <p className={`text-sm font-medium whitespace-nowrap ${amount >= 0 ? 'text-[#5a7a55]' : 'text-gray-500'}`}>
                      {amount >= 0 ? '+' : '−'}{formatCLP(amount)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-6 text-center">Todavía no tienes movimientos.</p>
          )}
        </section>
      </div>
    </div>
  )
}
