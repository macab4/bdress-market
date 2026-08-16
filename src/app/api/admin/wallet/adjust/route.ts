import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordAdminAdjustment } from '@/lib/wallet'
import { sendWalletBalanceChangedEmail } from '@/lib/email'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === process.env.ADMIN_EMAIL ? user : null
}

// Ajuste manual de saldo — SIEMPRE requiere motivo, nunca acepta un
// user_id directo del body (se busca por email para evitar que alguien
// pase el id de otra persona por error). idempotencyKey se genera acá
// mismo, una por request, para que un doble-submit del form no duplique
// el ajuste.
export async function POST(request: Request) {
  const adminUser = await checkAdmin()
  if (!adminUser) return Response.json({ error: 'Sin permiso' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const type = body?.type === 'admin_credit' || body?.type === 'admin_debit' ? body.type : null
  const amount = Number(body?.amount)
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  // 'promotional' agrega Crédito B-Dress (no transferible) en vez de saldo
  // real — acción explícitamente distinta a propósito (sección 16 del
  // encargo de referidos), nunca un default silencioso.
  const balanceType = body?.balanceType === 'promotional' ? 'promotional' : 'real'

  if (!email) return Response.json({ error: 'Falta el email de la usuaria' }, { status: 400 })
  if (!type) return Response.json({ error: 'Tipo de ajuste inválido' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) return Response.json({ error: 'Monto inválido' }, { status: 400 })
  if (!reason) return Response.json({ error: 'El motivo es obligatorio' }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, name').eq('email', email).maybeSingle()
  if (!profile) return Response.json({ error: 'No existe una cuenta con ese email' }, { status: 404 })

  const signedAmount = type === 'admin_credit' ? Math.round(amount) : -Math.round(amount)
  const result = await recordAdminAdjustment(admin, {
    userId: profile.id,
    type,
    amount: Math.round(amount),
    reason,
    idempotencyKey: crypto.randomUUID(),
    createdBy: adminUser.id,
    balanceType,
  })

  if (!result.ok) return Response.json({ error: result.error }, { status: 500 })
  await sendWalletBalanceChangedEmail({ to: email, name: profile.name, amount: signedAmount, reason, balanceType })
  return Response.json({ ok: true })
}
