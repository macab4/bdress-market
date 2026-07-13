import { Resend } from 'resend'

let client: Resend | null = null

function getClient() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY)
  return client
}

export function emailLayout(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <p style="font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: #8DA988; text-align: center; margin: 0 0 8px;">
        Bdress Market
      </p>
      <h1 style="font-size: 18px; font-weight: 300; letter-spacing: 1px; text-transform: uppercase; text-align: center; margin: 0 0 24px;">
        ${title}
      </h1>
      ${bodyHtml}
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
