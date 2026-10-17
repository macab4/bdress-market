import { sendEmail, emailLayout } from '@/lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const ORDER_ID = '7520a45f-5a8a-4195-bad9-07ea99f48c7f'
const BUYER_EMAIL = 'luzmariavelizs@gmail.com'
const BUYER_NAME = 'Luz'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Sin autorización' }, { status: 401 })
  }

  await sendEmail({
    to: BUYER_EMAIL,
    subject: 'Tu compra está confirmada y todo OK',
    html: emailLayout('Todo en orden', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${BUYER_NAME}, te escribimos para confirmarte que tu compra del <strong>Vestido largo ajustado elegante con espalda descubierta</strong> está todo en orden — tu pago quedó registrado correctamente.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hubo un problema técnico de nuestro lado que hizo que por un rato no se viera reflejado en la app, pero ya lo revisamos y corregimos — tu compra está activa y protegida. La vendedora ya fue avisada y tiene hasta 5 días hábiles para despacharla.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Gracias por tu paciencia, y disculpa el susto.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi compra
        </a>
      </p>
    `),
  })

  return Response.json({ ok: true, orderId: ORDER_ID })
}
