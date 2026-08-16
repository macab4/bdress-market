import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordWithdrawalHold, sendWithdrawalAlertEmail } from '@/lib/wallet'
import { MIN_WITHDRAWAL_AMOUNT } from '@/lib/catalog'

// Crea una solicitud de retiro. Secuencia pensada para no dejar filas
// huérfanas: primero se genera el id y se intenta la reserva del saldo
// (recordWithdrawalHold) — si falla (carrera de saldo insuficiente,
// protegida por el check de wallet_accounts), nunca se llega a insertar la
// fila en `withdrawals`. Recién si la reserva tiene éxito se inserta.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Sin sesión' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const bankAccountId = typeof body?.bankAccountId === 'string' ? body.bankAccountId : ''
  const useFullBalance = body?.useFullBalance === true
  if (!bankAccountId) return Response.json({ error: 'Falta la cuenta bancaria' }, { status: 400 })

  // RLS de bank_accounts (auth.uid() = user_id) hace de authorization check
  // acá: si la cuenta no es de esta usuaria, la fila simplemente no aparece.
  const { data: bankAccount } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('id', bankAccountId)
    .eq('is_active', true)
    .maybeSingle()
  if (!bankAccount) return Response.json({ error: 'Cuenta bancaria no encontrada o inactiva' }, { status: 404 })

  const admin = createAdminClient()

  const { data: existingActive } = await admin
    .from('withdrawals')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['pending', 'processing'])
    .maybeSingle()
  if (existingActive) return Response.json({ error: 'Ya tienes un retiro en curso' }, { status: 409 })

  const { data: account } = await admin
    .from('wallet_accounts')
    .select('available_balance')
    .eq('user_id', user.id)
    .maybeSingle()
  const availableBalance = account?.available_balance ?? 0

  const amount = useFullBalance ? availableBalance : Math.round(Number(body?.amount))
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Monto inválido' }, { status: 400 })
  if (amount > availableBalance) return Response.json({ error: 'El monto supera tu saldo disponible' }, { status: 400 })
  if (amount < MIN_WITHDRAWAL_AMOUNT) {
    return Response.json({ error: `El monto mínimo para retirar es $${MIN_WITHDRAWAL_AMOUNT.toLocaleString('es-CL')}` }, { status: 400 })
  }

  const withdrawalId = crypto.randomUUID()

  const holdResult = await recordWithdrawalHold(admin, { withdrawalId, userId: user.id, amount })
  if (!holdResult.ok) return Response.json({ error: holdResult.error }, { status: 500 })
  if (holdResult.skipped) return Response.json({ error: 'Conflicto al procesar el retiro, intenta de nuevo' }, { status: 409 })

  const { error: insertError } = await admin.from('withdrawals').insert({
    id: withdrawalId,
    user_id: user.id,
    bank_account_id: bankAccount.id,
    amount,
    status: 'pending',
    bank: bankAccount.bank,
    account_type: bankAccount.account_type,
    account_number: bankAccount.account_number,
    holder_rut: bankAccount.holder_rut,
    holder_name: bankAccount.holder_name,
    holder_email: bankAccount.holder_email,
    hold_transaction_id: holdResult.transactionId,
  })

  if (insertError) {
    await sendWithdrawalAlertEmail({ withdrawalId, reason: insertError.message })
    return Response.json({ error: 'El retiro se reservó pero hubo un error al registrarlo. Contacta soporte.' }, { status: 500 })
  }

  return Response.json({ ok: true, withdrawalId })
}
