import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordWithdrawalCompleted, recordWithdrawalCancelled } from '@/lib/wallet'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL ? user : null
}

const TRANSITIONS: Record<'processing' | 'completed' | 'rejected', string[]> = {
  processing: ['pending'],
  completed: ['pending', 'processing'],
  rejected: ['pending', 'processing'],
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await checkAdmin()
  if (!adminUser) return Response.json({ error: 'Sin permiso' }, { status: 403 })
  const { id } = await params

  const body = await request.json().catch(() => null)
  const action = body?.action as 'processing' | 'completed' | 'rejected' | undefined
  if (!action || !TRANSITIONS[action]) return Response.json({ error: 'Acción inválida' }, { status: 400 })

  const admin = createAdminClient()
  const { data: withdrawal } = await admin.from('withdrawals').select('*').eq('id', id).maybeSingle()
  if (!withdrawal) return Response.json({ error: 'Retiro no encontrado' }, { status: 404 })
  if (!TRANSITIONS[action].includes(withdrawal.status)) {
    return Response.json({ error: `No se puede pasar de "${withdrawal.status}" a "${action}"` }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === 'processing') {
    const { data: updated } = await admin.from('withdrawals')
      .update({ status: 'processing', admin_id: adminUser.id, updated_at: now })
      .eq('id', id).in('status', TRANSITIONS.processing)
      .select().maybeSingle()
    if (!updated) return Response.json({ error: 'Otro admin ya cambió el estado de este retiro' }, { status: 409 })
    return Response.json({ ok: true, withdrawal: updated })
  }

  if (action === 'completed') {
    const result = await recordWithdrawalCompleted(admin, {
      withdrawalId: id, userId: withdrawal.user_id, amount: withdrawal.amount, createdBy: adminUser.id,
    })
    if (!result.ok) return Response.json({ error: result.error }, { status: 500 })

    const { data: updated } = await admin.from('withdrawals')
      .update({
        status: 'completed', processed_at: now, admin_id: adminUser.id,
        operation_number: body?.operationNumber ?? null,
        receipt_url: body?.receiptUrl ?? null,
        internal_note: body?.internalNote ?? withdrawal.internal_note,
        completion_transaction_id: result.transactionId ?? null,
        updated_at: now,
      })
      .eq('id', id).in('status', TRANSITIONS.completed)
      .select().maybeSingle()
    // Si updated es null, otra request ganó la carrera actualizando la fila
    // primero — el ledger ya quedó correcto una sola vez gracias a la
    // idempotency_key, así que no es un error financiero, solo se devuelve
    // el estado final real.
    const finalRow = updated ?? (await admin.from('withdrawals').select('*').eq('id', id).maybeSingle()).data
    return Response.json({ ok: true, withdrawal: finalRow })
  }

  // action === 'rejected'
  const result = await recordWithdrawalCancelled(admin, {
    withdrawalId: id, userId: withdrawal.user_id, amount: withdrawal.amount,
    reason: body?.internalNote ? `Retiro rechazado: ${body.internalNote}` : 'Retiro rechazado — saldo liberado',
    createdBy: adminUser.id,
  })
  if (!result.ok) return Response.json({ error: result.error }, { status: 500 })

  const { data: updated } = await admin.from('withdrawals')
    .update({
      status: 'rejected', processed_at: now, admin_id: adminUser.id,
      internal_note: body?.internalNote ?? withdrawal.internal_note,
      completion_transaction_id: result.transactionId ?? null,
      updated_at: now,
    })
    .eq('id', id).in('status', TRANSITIONS.rejected)
    .select().maybeSingle()
  const finalRow = updated ?? (await admin.from('withdrawals').select('*').eq('id', id).maybeSingle()).data
  return Response.json({ ok: true, withdrawal: finalRow })
}
