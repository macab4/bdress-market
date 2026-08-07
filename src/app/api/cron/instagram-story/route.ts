import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import { generateNewArrivalsStoryPng, ProductCandidate } from '@/lib/instagramStory'

// Cuántos días hacia atrás cuentan como "últimos ingresos". Con un poco de
// margen sobre el ritmo semanal del cron (ver vercel.json) para tolerar que
// se atrase o que la ejecución de una semana falle.
const RECENT_DAYS = 8
const MIN_LISTINGS = 3
// Candidatas de sobra (10-20 sugeridas en el encargo) para que, aunque
// algunas queden descartadas por no tener ninguna foto válida, casi siempre
// se llegue a los 6 productos reales sin caer en el placeholder de marca.
const CANDIDATE_POOL_SIZE = 20

// Se ejecuta semanalmente vía Vercel Cron (ver vercel.json). Arma una
// historia de Instagram (1080x1920) con las prendas más nuevas publicadas
// y se la manda por correo a ADMIN_EMAIL como adjunto — la sube manualmente
// a Instagram, sin publicación automática (evita depender de la API de
// negocio de Meta para algo tan simple).
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }
  if (!process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'ADMIN_EMAIL no configurado' }, { status: 500 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: listings, error } = await admin
    .from('listings')
    .select('title, brand, price, photos, created_at')
    .eq('status', 'active')
    .gt('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(CANDIDATE_POOL_SIZE)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!listings || listings.length < MIN_LISTINGS) {
    return Response.json({ sent: false, reason: 'No hay suficientes prendas nuevas esta semana', count: listings?.length ?? 0 })
  }

  const candidates: ProductCandidate[] = listings.map(l => ({
    name: l.brand || l.title,
    price: l.price,
    photos: l.photos ?? [],
  }))

  let buffer: Buffer
  try {
    buffer = await generateNewArrivalsStoryPng({
      candidates,
      subtitle: 'Piezas únicas recién publicadas',
    })
  } catch (err) {
    console.error('[instagram-story] error generando la gráfica:', err)
    return Response.json({ error: 'No se pudo generar la gráfica' }, { status: 500 })
  }

  // Modo vista previa: devuelve el PNG directo en vez de mandarlo por
  // correo — útil para revisar la gráfica sin esperar/spamear el inbox.
  const { searchParams } = new URL(request.url)
  if (searchParams.get('preview') === '1') {
    return new Response(new Uint8Array(buffer), { headers: { 'Content-Type': 'image/png' } })
  }

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: 'Tu historia de Instagram — Últimos ingresos',
    html: emailLayout('Historia lista para subir', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Te dejamos la historia de "Últimos ingresos" de esta semana. Descarga la imagen adjunta y súbela directo
        a tu historia de Instagram.
      </p>
    `),
    attachments: [{ filename: 'ultimos-ingresos.png', content: buffer, contentType: 'image/png' }],
  })

  return Response.json({ sent: true, count: candidates.length })
}
