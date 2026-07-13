import { sendEmail, emailLayout } from '@/lib/email'

const CONTACT_EMAIL = process.env.CONTACT_EMAIL!

export async function POST(request: Request) {
  let name: string
  let email: string
  let phone: string
  let comment: string

  try {
    const body = await request.json()
    email = body.email
    comment = body.comment
    if (!email || !comment) throw new Error()
    name = typeof body.name === 'string' ? body.name : ''
    phone = typeof body.phone === 'string' ? body.phone : ''
  } catch {
    return Response.json({ error: 'Email y comentario son requeridos' }, { status: 400 })
  }

  await sendEmail({
    to: CONTACT_EMAIL,
    subject: `Nuevo mensaje de contacto${name ? ` — ${name}` : ''}`,
    html: emailLayout('Mensaje de contacto', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        <strong>Nombre:</strong> ${name || '—'}<br>
        <strong>Email:</strong> ${email}<br>
        <strong>Teléfono:</strong> ${phone || '—'}
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6; white-space: pre-line;">${comment}</p>
    `),
  })

  return Response.json({ ok: true })
}
