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
      <a href="${siteUrl}" style="display: block; text-decoration: none; text-align: center; margin: 0 0 8px;">
        <span style="font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: #8DA988;">
          Bdress Market
        </span>
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
