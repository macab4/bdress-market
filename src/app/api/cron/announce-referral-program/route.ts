import { createAdminClient } from '@/lib/supabase/admin'
import { sendReferralProgramAnnouncementEmail } from '@/lib/email'
import { ensureReferralCode, buildReferralLink } from '@/lib/referrals'

// Anuncio único del programa de referidos — NO es un cron recurrente
// (aunque vive en cron/ y usa la misma autenticación por CRON_SECRET que
// el resto): en vercel.json queda fijado a una fecha puntual (día y mes
// específicos), así que solo dispara una vez y no vuelve a correr hasta el
// mismo día del año siguiente — suficiente para "mándalo mañana" sin
// necesitar infraestructura de jobs de una sola vez que hoy no existe en
// este proyecto.
//
// Audiencia: vendedoras actuales (al menos una prenda publicada) — no hay
// una noción de "usuaria activa" en la base de datos, así que se define
// así porque son quienes mejor entienden Bdress y las candidatas más
// naturales para invitar a otras a vender (confirmado con la usuaria).
//
// Envío secuencial (no Promise.all) a propósito — con una lista de
// vendedoras real, mandar todo de golpe podría chocar con el límite de
// requests por segundo de Resend; un cron no tiene apuro.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: sellerListings } = await admin.from('listings').select('seller_id')
  const sellerIds = Array.from(new Set((sellerListings ?? []).map(l => l.seller_id)))
  if (sellerIds.length === 0) return Response.json({ sent: 0 })

  const { data: sellers } = await admin
    .from('profiles')
    .select('id, email, name')
    .in('id', sellerIds)

  let sent = 0
  for (const seller of sellers ?? []) {
    if (!seller.email) continue
    const code = await ensureReferralCode(admin, seller.id)
    await sendReferralProgramAnnouncementEmail({
      to: seller.email, name: seller.name, referralLink: buildReferralLink(code),
    })
    sent++
  }

  return Response.json({ sent, audience: sellers?.length ?? 0 })
}
