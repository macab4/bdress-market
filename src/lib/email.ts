import { Resend } from 'resend'

let client: Resend | null = null

function getClient() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export function emailLayout(title: string, bodyHtml: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <a href="${siteUrl}" style="display: block; text-align: center; margin: 0 0 16px;">
        <img src="${siteUrl}/logo.png" alt="Bdress Market" width="140" style="display: inline-block; height: auto;" />
      </a>
      <h1 style="font-size: 18px; font-weight: 300; letter-spacing: 1px; text-transform: uppercase; text-align: center; margin: 0 0 24px;">
        ${title}
      </h1>
      ${bodyHtml}
      <p style="text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee;">
        <a href="${siteUrl}/nosotros" style="font-size: 10px; color: #999; text-decoration: none; margin: 0 8px;">Quiénes somos</a>
        <a href="${siteUrl}/terminos" style="font-size: 10px; color: #999; text-decoration: none; margin: 0 8px;">Términos y condiciones</a>
      </p>
      <p style="text-align: center; margin-top: 12px;">
        <span style="font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-right: 6px;">Síguenos</span>
        <a href="https://www.instagram.com/bdress.cl" style="font-size: 14px; text-decoration: none;">📷</a>
      </p>
    </div>
  `
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
    })
  } catch (error) {
    // Nunca dejamos que un email fallido rompa el flujo de compra/despacho
    console.error('Error enviando email:', error)
  }
}

// Se dispara cuando una orden pasa a "completed" (cron de auto-liberación o
// resolución manual de una disputa) y de nuevo, una sola vez, si a los
// REVIEW_FOLLOWUP_DAYS nadie dejó su reseña — ver
// src/app/api/cron/review-followup/route.ts. Sirve para ambos lados: la
// compradora reseña a la vendedora y viceversa, igual que en Vinted.
export async function sendReviewReminderEmail({
  to,
  name,
  listingTitle,
  role,
  followup = false,
}: {
  to: string
  name: string | null
  listingTitle: string
  role: 'buyer' | 'seller'
  followup?: boolean
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const dashboardPath = role === 'buyer' ? '/dashboard/purchases' : '/dashboard/sales'
  const otherParty = role === 'buyer' ? 'la vendedora' : 'la compradora'
  const transactionWord = role === 'buyer' ? 'compra' : 'venta'

  const subject = followup
    ? `Aún puedes dejar tu reseña — ${listingTitle}`
    : `¿Qué te pareció tu ${transactionWord}? — ${listingTitle}`

  const intro = followup
    ? `Hola ${name ?? ''}, todavía no dejas tu reseña de <strong>${listingTitle}</strong>. Solo toma un minuto y ayuda a ${otherParty} y a toda la comunidad.`
    : `Hola ${name ?? ''}, tu ${transactionWord} de <strong>${listingTitle}</strong> ya se completó. Contanos cómo te fue con ${otherParty} — tu reseña ayuda a que la comunidad compre y venda con más confianza.`

  await sendEmail({
    to,
    subject,
    html: emailLayout(followup ? 'Te falta dejar tu reseña' : 'Ya puedes dejar tu reseña', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        ${intro}
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}${dashboardPath}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Dejar mi reseña
        </a>
      </p>
    `),
  })
}
