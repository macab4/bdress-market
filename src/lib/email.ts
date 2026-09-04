import { Resend } from 'resend'
import { leadTimeRange, internationalDelayMessage, INTERNATIONAL_AVAILABILITY_WARNING } from '@/lib/international/content'
import { SHIP_DEADLINE_BUSINESS_DAYS, CONFIRMED_HOLD_DAYS, REFERRAL_REWARD_AMOUNT, BOOST_PRICE, BOOST_DURATION_DAYS } from '@/lib/catalog'

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
        <a href="https://www.instagram.com/bdressmarket/" style="font-size: 14px; text-decoration: none;">📷</a>
      </p>
    </div>
  `
}

export async function sendEmail({
  to, subject, html, attachments,
}: {
  to: string
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}) {
  try {
    await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to,
      subject,
      html,
      attachments,
    })
  } catch (error) {
    // Nunca dejamos que un email fallido rompa el flujo de compra/despacho
    console.error('Error enviando email:', error)
  }
}

// Correo de reactivación para vendedoras del marketplace antiguo (Shopify),
// donde se cobraba 5-15% + IVA de comisión. Sus prendas ya están cargadas en
// la nueva plataforma pero en estado "paused" desde la migración — nunca las
// activaron. En la nueva plataforma vender es 100% gratis — ver
// src/app/terminos/page.tsx. Se dispara manualmente desde
// /api/admin/campaign/commission-free, no por un cron.
export async function sendCommissionFreeCampaignEmail({
  to,
  name,
}: {
  to: string
  name: string | null
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: 'Antes perdías hasta 15% de comisión. Ahora es 100% tuyo.',
    html: emailLayout('0% comisión para vendedoras', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, en el Bdress Market de antes, cada venta te descontaba
        entre 5% y 15% + IVA en comisión. Ese modelo ya no existe.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hoy vender en Bdress Market es <strong>100% gratis</strong>: fijas tu precio
        y te lo llevas completo. El único cargo (Protección BDress) lo paga la
        compradora, nunca tú.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Tus prendas ya están cargadas en tu cuenta, solo están pausadas desde que
        migramos la plataforma. Actívalas para que vuelvan a verse en el marketplace.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px;">
        <tr>
          <td style="padding: 12px; border: 1px solid #eee; color: #999; text-align: center;">
            Antes<br /><strong style="color: #444; font-size: 16px;">85-95%</strong><br />de tu venta
          </td>
          <td style="padding: 12px; border: 1px solid #eee; text-align: center; background: #f8f8f8;">
            Ahora<br /><strong style="font-size: 16px;">100%</strong><br />de tu venta
          </td>
        </tr>
      </table>
      <p style="text-align: center; margin-top: 8px;">
        <a href="${siteUrl}/dashboard/sales" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Activar mis prendas
        </a>
      </p>
    `),
  })
}

// Correo de recuperación de carrito abandonado — orden que quedó en
// pending_payment sin completar el pago, o que Mercado Pago rechazó/expiró
// sin llegar a 'paid' (paid_at null). Se dispara desde el cron
// abandoned-cart-recovery y desde el botón manual del panel admin
// (/admin/orders/abandoned) — ver PENDING_ORDER_EXPIRY_MINUTES en catalog.ts.
export async function sendAbandonedCartRecoveryEmail({
  to,
  name,
  listingTitle,
  listingId,
  amount,
}: {
  to: string
  name: string | null
  listingTitle: string
  listingId: string
  amount: number
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: `¿Se te quedó algo pendiente? — ${listingTitle}`,
    html: emailLayout('Tu prenda sigue esperándote', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, notamos que no alcanzaste a completar tu compra de
        <strong>${listingTitle}</strong> (${'$'}${amount.toLocaleString('es-CL')}). No te
        preocupes, no te cobramos nada — la prenda sigue disponible.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Si quieres retomarla, puedes terminar tu compra en un par de clics.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/listings/${listingId}/checkout" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Terminar mi compra
        </a>
      </p>
    `),
  })
}

// Correo de lanzamiento para vendedoras del marketplace antiguo (Shopify) que
// nunca se han logueado en la plataforma nueva — su email ya está confirmado
// desde la migración, pero no tienen contraseña conocida, así que el primer
// paso es "olvidé mi contraseña". Sus prendas siguen en "paused" desde la
// migración. Se dispara manualmente desde /api/admin/campaign/activate-account.
export async function sendActivateAccountEmail({
  to,
  name,
}: {
  to: string
  name: string | null
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: 'Bdress Market ya está en línea — activa tu cuenta y tus prendas',
    html: emailLayout('Ya estamos en línea', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, ¡ya lanzamos el nuevo Bdress Market al público! Tus prendas
        de la plataforma anterior ya están cargadas en tu cuenta, pero siguen
        pausadas — nadie puede verlas todavía.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        <strong>Para activarlas:</strong>
      </p>
      <ol style="font-size: 14px; color: #444; line-height: 1.8; padding-left: 20px;">
        <li>Entra a bdressmarket.cl y haz clic en "¿Olvidaste tu contraseña?" con
          tu correo (${to}) para crear una contraseña nueva — es tu primera vez
          entrando a la plataforma nueva.</li>
        <li>Una vez dentro, ve a tu perfil y activa cada prenda pausada.</li>
      </ol>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Recuerda: vender ahora es <strong>100% gratis</strong>, sin comisión.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/auth/forgot-password" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Activar mi cuenta
        </a>
      </p>
    `),
  })
}

// Cuenta creada a mano desde /admin/users (ej. una contacto de la lista de
// marketing a la que se le crea la cuenta por adelantado) — a diferencia de
// sendActivateAccountEmail, no asume prendas migradas ni menciona el
// relanzamiento, solo invita a poner contraseña y subir su primera prenda.
export async function sendManualAccountWelcomeEmail({
  to,
  name,
}: {
  to: string
  name: string | null
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: 'Te creamos tu cuenta en Bdress Market',
    html: emailLayout('Bienvenida a Bdress Market', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, te creamos una cuenta en Bdress Market para que puedas
        subir y vender tus vestidos.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        <strong>Para activarla:</strong>
      </p>
      <ol style="font-size: 14px; color: #444; line-height: 1.8; padding-left: 20px;">
        <li>Entra a bdressmarket.cl y haz clic en "¿Olvidaste tu contraseña?" con
          tu correo (${to}) para crear tu contraseña — es tu primera vez entrando.</li>
        <li>Una vez dentro, ve a "+ Vender" y sube tu primera prenda.</li>
      </ol>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Vender es <strong>100% gratis</strong>, sin comisión.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/auth/forgot-password" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Crear mi contraseña
        </a>
      </p>
    `),
  })
}

// Seguimiento para las vendedoras migradas que sí intentaron "olvidé mi
// contraseña" tras sendActivateAccountEmail pero nunca lograron entrar —
// el cliente de Supabase usaba PKCE sin ningún endpoint que intercambiara
// el code (ver src/lib/supabase/client.ts), así que el reset fallaba en
// silencio. Se dispara manualmente desde
// /api/admin/campaign/password-reset-fixed, solo a esa lista puntual.
export async function sendPasswordResetFixedEmail({
  to,
  name,
}: {
  to: string
  name: string | null
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: 'Arreglamos el problema para crear tu contraseña — vuelve a intentarlo',
    html: emailLayout('Ya puedes entrar', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, detectamos que el link para crear tu contraseña no estaba
        funcionando bien y ya lo arreglamos.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Vuelve a intentarlo: entra a bdressmarket.cl → "¿Olvidaste tu contraseña?" →
        ingresa tu correo (${to}) para crear una contraseña nueva y así puedas
        activar tu cuenta y tus prendas.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Una vez dentro, ve a tu perfil y activa cada prenda pausada.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/auth/forgot-password" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Reintentar
        </a>
      </p>
    `),
  })
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

// Recordatorio diario a la vendedora mientras su venta siga sin despachar
// (ver api/cron/ship-reminder) — a propósito insiste en "si ya la enviaste,
// ignora este correo" porque se manda todos los días sin esperar a que el
// sistema confirme el despacho, para no generar dudas si hay un desfase
// entre que ella la despacha y que queda registrado.
export async function sendShipReminderEmail({
  to,
  name,
  listingTitle,
  daysElapsed,
  deadlineDays,
}: {
  to: string
  name: string | null
  listingTitle: string
  daysElapsed: number
  deadlineDays: number
}) {
  const overdue = daysElapsed > deadlineDays
  const daysLeft = deadlineDays - daysElapsed

  const urgencyLine = overdue
    ? `Ya pasó tu plazo de <strong>${deadlineDays} días hábiles</strong> para despachar — la compradora puede solicitar el reembolso completo en cualquier momento. Despáchala hoy para evitarlo.`
    : daysLeft <= 1
      ? `Hoy es tu último día dentro del plazo de <strong>${deadlineDays} días hábiles</strong> para despachar.`
      : `Te quedan <strong>${daysLeft} días hábiles</strong> de tu plazo de ${deadlineDays} días para despachar.`

  await sendEmail({
    to,
    subject: overdue ? `Tu plazo de envío ya venció — ${listingTitle}` : `Recuerda despachar — ${listingTitle}`,
    html: emailLayout('Recordatorio de despacho', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, todavía no registramos el despacho de <strong>${listingTitle}</strong>.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        ${urgencyLine}
      </p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/sales" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ir a Mis ventas
        </a>
      </p>
      <p style="font-size: 12px; color: #999; line-height: 1.6; text-align: center;">
        Si ya la enviaste, ignora este correo — puede que todavía no se refleje en el sistema.
      </p>
    `),
  })
}

// Confirmación inmediata a la vendedora cuando pide la etiqueta en modo
// manual (MANUAL_LABEL_MODE) — sin esto, no recibía ninguna respuesta hasta
// que la admin le mandaba la etiqueta real más tarde (sendLabelReadyEmail),
// lo que podía sentirse como "no pasó nada" o generar dudas de si eran dos
// avisos distintos o uno repetido.
export async function sendLabelRequestReceivedEmail({
  to,
  name,
  listingTitle,
}: {
  to: string
  name: string | null
  listingTitle: string
}) {
  await sendEmail({
    to,
    subject: `Recibimos tu pedido de etiqueta — ${listingTitle}`,
    html: emailLayout('Etiqueta en camino', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, recibimos tu pedido de etiqueta de envío para <strong>${listingTitle}</strong>.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        En breve te vamos a enviar la etiqueta lista para imprimir en un correo aparte — todavía no es este.
      </p>
    `),
  })
}

// Correo a la vendedora con la etiqueta de envío lista para imprimir —
// mismo contenido tanto si la generó automáticamente el courier (ver
// api/orders/[id]/generate-label, siempre Starken) como si la admin la subió
// a mano en modo manual (ver api/admin/orders/[id]/label, transportista
// detectado o ingresado a mano), para no duplicar este HTML. El link pasa
// por /api/orders/[id]/label/download (no directo al archivo) para poder
// registrar cuándo la vendedora lo descarga por primera vez — también queda
// disponible desde "Mis ventas" con el mismo link.
export async function sendLabelReadyEmail({
  to,
  name,
  listingTitle,
  orderId,
  trackingNumber,
  carrierInstructions,
  deadline,
}: {
  to: string
  name: string | null
  listingTitle: string
  orderId: string
  trackingNumber?: string | null
  carrierInstructions: string
  deadline?: Date | null
}) {
  const downloadUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/orders/${orderId}/label/download`
  const deadlineFmt = deadline ? deadline.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' }) : null
  await sendEmail({
    to,
    subject: `Tu etiqueta de envío está lista — ${listingTitle}`,
    html: emailLayout('Etiqueta lista 💚', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu prenda <strong>${listingTitle}</strong> fue vendida y ya puedes realizar el despacho.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        ${carrierInstructions}
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Tienes un plazo máximo de <strong>${SHIP_DEADLINE_BUSINESS_DAYS} días hábiles</strong>${deadlineFmt ? ` (hasta el ${deadlineFmt})` : ''} para realizar el envío.
      </p>
      ${trackingNumber ? `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        N.º de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
      </p>` : ''}
      <p style="text-align: center; margin: 24px 0;">
        <a href="${downloadUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Descargar etiqueta
        </a>
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Recuerda imprimir la etiqueta, pegarla correctamente en el paquete y entregarlo en el punto correspondiente.
      </p>
    `),
  })
}

// Aviso a la compradora en el mismo momento en que se le envía la etiqueta a
// la vendedora — antes de esto no recibía nada hasta el correo de "ya fue
// despachada" (order.status = 'shipped'), este es un touchpoint intermedio
// para que sepa que su compra ya está en preparación.
export async function sendLabelSentToBuyerEmail({
  to,
  name,
  listingTitle,
  carrierLabel,
  trackingNumber,
  deadline,
}: {
  to: string
  name: string | null
  listingTitle: string
  carrierLabel?: string | null
  trackingNumber?: string | null
  deadline?: Date | null
}) {
  const deadlineFmt = deadline ? deadline.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' }) : null
  await sendEmail({
    to,
    subject: `Tu compra ya está en preparación — ${listingTitle}`,
    html: emailLayout('En preparación 💚', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu compra <strong>${listingTitle}</strong> ya está preparando su camino hacia ti.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        La etiqueta de envío ya fue generada y enviada a la vendedora. Tiene un plazo máximo de
        <strong>${SHIP_DEADLINE_BUSINESS_DAYS} días hábiles</strong>${deadlineFmt ? ` (hasta el ${deadlineFmt})` : ''}
        para despachar tu compra${carrierLabel ? ` a través de ${carrierLabel}` : ''}.
      </p>
      ${trackingNumber ? `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        N.º de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
      </p>` : ''}
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Una vez que recibas tu compra, tendrás 2 días para informarnos si existe algún problema con el pedido.
        Pasado ese plazo, la compra se considerará recibida correctamente y podremos liberar el pago a la vendedora.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi compra
        </a>
      </p>
    `),
  })
}

// ============================================================
// Correos de la modalidad "Selección internacional" (Vinted España u otra
// plataforma internacional). Mismo proveedor (Resend) y mismo patrón
// sendEmail()+emailLayout() que el resto de este archivo — ver
// src/lib/international/ para el estado que dispara cada uno.
// ============================================================

function purchasesLink(): string {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/purchases`
}

export async function sendInternationalOrderReceivedEmail({
  to, name, listingTitle, minDays, maxDays,
}: { to: string; name: string | null; listingTitle: string; minDays?: number | null; maxDays?: number | null }) {
  const { min, max } = leadTimeRange(minDays, maxDays)
  await sendEmail({
    to,
    subject: `Recibimos tu compra — ${listingTitle}`,
    html: emailLayout('Compra recibida', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, recibimos tu pago por <strong>${listingTitle}</strong>. Este producto tiene envío
        internacional gestionado por Bdress Market — te avisamos apenas tengamos novedades de tu pedido.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Entrega estimada: entre ${min} y ${max} días corridos.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        ${INTERNATIONAL_AVAILABILITY_WARNING}
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

export async function sendInternationalAvailabilityConfirmedEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Tu pedido está en proceso — ${listingTitle}`,
    html: emailLayout('Pedido en proceso', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu compra de <strong>${listingTitle}</strong> ya está en proceso — estamos gestionando
        su envío internacional.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

export async function sendInternationalUnavailableCancelledEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Anulamos tu compra de ${listingTitle}`,
    html: emailLayout('Compra anulada', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, lamentablemente no pudimos completar el envío internacional de tu compra de
        <strong>${listingTitle}</strong>. Anulamos tu orden — no te cobramos nada y ya iniciamos la devolución
        completa de tu pago.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Te avisamos apenas el reembolso esté confirmado por el medio de pago.
      </p>
    `),
  })
}

export async function sendInternationalPurchasedEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Tu compra avanza — ${listingTitle}`,
    html: emailLayout('Compra en preparación', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu compra de <strong>${listingTitle}</strong> ya está en preparación. Pronto la
        trasladamos a Chile.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

export async function sendInternationalTransitUpdateEmail({
  to, name, listingTitle, stage,
}: { to: string; name: string | null; listingTitle: string; stage: 'received_at_foreign_hub' | 'international_transit' }) {
  const copy = stage === 'received_at_foreign_hub'
    ? 'ya inició su envío internacional'
    : 'ya va en tránsito hacia Chile'
  await sendEmail({
    to,
    subject: `Actualización de tu pedido — ${listingTitle}`,
    html: emailLayout('Actualización de envío', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu pedido de <strong>${listingTitle}</strong> ${copy}.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

export async function sendInternationalReceivedInChileEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Tu prenda ya llegó a Chile — ${listingTitle}`,
    html: emailLayout('Recibida en Chile', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, <strong>${listingTitle}</strong> ya llegó a Chile. La estamos revisando antes de
        despacharla a tu dirección.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

export async function sendInternationalNationallyShippedEmail({
  to, name, listingTitle, trackingNumber,
}: { to: string; name: string | null; listingTitle: string; trackingNumber: string | null }) {
  await sendEmail({
    to,
    subject: `Tu prenda va en camino — ${listingTitle}`,
    html: emailLayout('Despachada dentro de Chile', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, después de su viaje desde el extranjero, <strong>${listingTitle}</strong> ya fue
        despachada dentro de Chile.
      </p>
      ${trackingNumber ? `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Número de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
      </p>` : ''}
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi compra
        </a>
      </p>
    `),
  })
}

export async function sendInternationalRefundInitiatedEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Iniciamos tu reembolso — ${listingTitle}`,
    html: emailLayout('Reembolso en proceso', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, iniciamos el reembolso completo de tu compra de <strong>${listingTitle}</strong>. Te
        avisamos apenas el medio de pago confirme que el dinero ya está de vuelta en tu cuenta.
      </p>
    `),
  })
}

export async function sendInternationalRefundCompletedEmail({
  to, name, listingTitle, amount,
}: { to: string; name: string | null; listingTitle: string; amount: number }) {
  await sendEmail({
    to,
    subject: `Reembolso completado — ${listingTitle}`,
    html: emailLayout('Reembolso completado', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, confirmamos que te devolvimos <strong>$${amount.toLocaleString('es-CL')}</strong> por
        <strong>${listingTitle}</strong>. Dependiendo de tu banco, puede tardar unos días en reflejarse.
      </p>
    `),
  })
}

export async function sendInternationalDelayNoticeEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  await sendEmail({
    to,
    subject: `Tu pedido está tardando más de lo esperado — ${listingTitle}`,
    html: emailLayout('Seguimos tu pedido de cerca', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, ${internationalDelayMessage().toLowerCase()}
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Esto puede pasar por tiempos de aduana o de traslado internacional — no significa que algo salió mal con
        tu compra de <strong>${listingTitle}</strong>.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${purchasesLink()}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Seguir mi pedido
        </a>
      </p>
    `),
  })
}

// A ADMIN_EMAIL, cuando una orden internacional recién pagada necesita
// validación manual urgente — dispara desde payment/confirm/route.ts.
export async function sendInternationalAdminActionNeededEmail({
  to, orderId, listingTitle, amountFmt, buyerName,
}: { to: string; orderId: string; listingTitle: string; amountFmt: string; buyerName: string }) {
  const adminLink = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/international/orders`
  await sendEmail({
    to,
    subject: `Acción urgente — comprobar disponibilidad de ${listingTitle}`,
    html: emailLayout('Validar disponibilidad internacional', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Se pagó la orden internacional <strong>${orderId}</strong> por <strong>${listingTitle}</strong> (${amountFmt}).
        Compradora: ${buyerName}. Confirma cuanto antes si la prenda sigue disponible en la plataforma de origen.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${adminLink}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ir a órdenes internacionales
        </a>
      </p>
    `),
  })
}

// Recordatorio semanal a ADMIN_EMAIL (ver api/cron/international-availability-reminder)
// — nunca revisa Vinted sola, solo le avisa a la admin cuáles le faltan
// comprobar a mano hace más de 7 días, reusando el mismo botón "Comprobar
// disponibilidad" que ya existe en /admin/international.
export async function sendInternationalAvailabilityReminderEmail({
  to,
  items,
}: {
  to: string
  items: { listingId: string; title: string; daysSinceVerified: number | null }[]
}) {
  const adminLink = `${process.env.NEXT_PUBLIC_SITE_URL}/admin/international`
  const rows = items.map(item => `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #444; border-bottom: 1px solid #eee;">${item.title}</td>
      <td style="padding: 8px 0; font-size: 13px; color: #888; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
        ${item.daysSinceVerified === null ? 'Nunca comprobada' : `Hace ${item.daysSinceVerified} días`}
      </td>
    </tr>
  `).join('')

  await sendEmail({
    to,
    subject: `${items.length} ${items.length === 1 ? 'prenda internacional' : 'prendas internacionales'} sin comprobar disponibilidad`,
    html: emailLayout('Comprobar disponibilidad', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Estas prendas de Selección internacional llevan más de 7 días sin que se confirme si siguen disponibles en la
        plataforma de origen. Revísalas y usa "Comprobar disponibilidad" en cada una.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
        ${rows}
      </table>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${adminLink}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ir a Selección internacional
        </a>
      </p>
    `),
  })
}

// Prenda despachada (flujo nacional) — la manda tanto el propio envío de la
// vendedora (api/orders/[id]/ship) como el respaldo de la admin
// (api/admin/orders/[id]/mark-shipped) cuando la vendedora nunca vuelve a
// ingresar el número de seguimiento aunque el courier ya lo tenga.
export async function sendOrderShippedEmail({
  to, name, listingTitle, trackingNumber,
}: { to: string; name: string | null; listingTitle: string; trackingNumber: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to,
    subject: `Tu prenda va en camino — ${listingTitle}`,
    html: emailLayout('Prenda despachada', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu compra <strong>${listingTitle}</strong> ya fue despachada.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Número de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi compra
        </a>
      </p>
    `),
  })
}

// Entrega confirmada — arranca el plazo de CONFIRMED_HOLD_DAYS para
// reportar un problema antes de liberar el pago a la vendedora. La manda
// tanto la confirmación de la propia compradora (api/orders/[id]/confirm)
// como el respaldo de la admin (api/admin/orders/[id]/mark-delivered)
// cuando el courier ya confirmó la entrega pero la compradora nunca entra a
// confirmarla — el texto deja explícito que fue la admin quien lo registró,
// nunca se hace pasar por una confirmación de la compradora que no ocurrió.
export async function sendDeliveryConfirmedEmail({
  to, name, listingTitle, role, confirmedByAdmin = false,
}: { to: string; name: string | null; listingTitle: string; role: 'buyer' | 'seller'; confirmedByAdmin?: boolean }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const dashboardPath = role === 'buyer' ? '/dashboard/purchases' : '/dashboard/sales'

  const subject = role === 'buyer'
    ? (confirmedByAdmin ? `Registramos la entrega de tu compra — ${listingTitle}` : `Confirmaste la recepción — ${listingTitle}`)
    : (confirmedByAdmin ? `Se registró la entrega de tu venta — ${listingTitle}` : `La compradora confirmó la recepción — ${listingTitle}`)

  const intro = role === 'buyer'
    ? (confirmedByAdmin
        ? `Hola ${name ?? ''}, registramos la entrega de <strong>${listingTitle}</strong> según el seguimiento del courier.`
        : `Hola ${name ?? ''}, confirmamos que recibiste <strong>${listingTitle}</strong>.`)
    : (confirmedByAdmin
        ? `Hola ${name ?? ''}, registramos que se entregó <strong>${listingTitle}</strong> según el seguimiento del courier.`
        : `Hola ${name ?? ''}, la compradora confirmó que recibió <strong>${listingTitle}</strong>.`)

  const followup = role === 'buyer'
    ? `Todavía tienes ${CONFIRMED_HOLD_DAYS} días para reportar un problema si algo no está bien. Pasado ese plazo, liberamos el pago a la vendedora.`
    : `Si no reporta un problema, en ${CONFIRMED_HOLD_DAYS} días liberamos tu pago.`

  await sendEmail({
    to,
    subject,
    html: emailLayout('Recepción confirmada', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        ${intro} ${followup}
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}${dashboardPath}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi ${role === 'buyer' ? 'compra' : 'venta'}
        </a>
      </p>
    `),
  })
}

// Aviso de que el Saldo B-Dress de la usuaria cambió — hoy se dispara solo
// desde dos lugares: cuando se libera una venta (sale_release, dinero recién
// disponible para usar o retirar) y cuando la admin hace un ajuste manual
// (admin_credit/admin_debit). Los movimientos automáticos de compra
// (hold/completed/cancelled) no mandan este correo a propósito — pasan
// dentro del mismo flujo de checkout que la usuaria ya está viendo en
// pantalla, avisarle por email además sería ruido.
export async function sendWalletBalanceChangedEmail({
  to, name, amount, reason, balanceType = 'real',
}: { to: string; name: string | null; amount: number; reason: string; balanceType?: 'real' | 'promotional' }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const isCredit = amount > 0
  const balanceLabel = balanceType === 'promotional' ? 'Crédito B-Dress' : 'Saldo B-Dress'
  await sendEmail({
    to,
    subject: isCredit ? `Tu ${balanceLabel} aumentó` : `Tu ${balanceLabel} cambió`,
    html: emailLayout(isCredit ? 'Saldo acreditado' : 'Ajuste de saldo', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu ${balanceLabel} ${isCredit ? 'aumentó en' : 'se ajustó en'}
        <strong>${isCredit ? '+' : '-'}$${Math.abs(amount).toLocaleString('es-CL')}</strong>.
      </p>
      ${balanceType === 'promotional' ? `
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Este crédito es promocional: sirve para comprar en Bdress Market, pero no se puede transferir ni retirar.
      </p>` : ''}
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Motivo: ${reason}.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/dashboard/wallet" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi saldo
        </a>
      </p>
    `),
  })
}

// Resumen diario a ADMIN_EMAIL (ver cron/admin-shipping-digest) de órdenes
// nacionales que necesitan que la admin las marque a mano — porque la
// vendedora nunca volvió a ingresar el seguimiento, o la compradora nunca
// confirmó recepción aunque el courier ya la haya entregado. Solo se manda
// si hay al menos una orden en alguna de las dos listas.
// Digest diario de "nuevas prendas de quienes sigues" — cron
// follow-digest. La notificación in-app (tabla notifications, tipo
// 'new_listing') ya existía vía el trigger notify_followers_new_listing;
// esto agrega el aviso por correo que faltaba, agrupando todas las
// prendas nuevas del día en un solo email por compradora.
export async function sendNewListingsDigestEmail({
  to,
  name,
  items,
}: {
  to: string
  name: string | null
  items: { listingId: string; listingTitle: string; sellerName: string | null; price: number; photo: string | null }[]
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const shown = items.slice(0, 6)
  const extra = items.length - shown.length

  const rows = shown.map(item => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
        <a href="${siteUrl}/listings/${item.listingId}" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 12px;">
          ${item.photo ? `<img src="${item.photo}" width="56" height="70" style="object-fit: cover; flex-shrink: 0;" />` : ''}
          <span>
            <span style="display: block; font-size: 13px; color: #111;">${item.listingTitle}</span>
            <span style="display: block; font-size: 11px; color: #999; margin-top: 2px;">${item.sellerName ?? 'Vendedora'} · $${item.price.toLocaleString('es-CL')}</span>
          </span>
        </a>
      </td>
    </tr>
  `).join('')

  await sendEmail({
    to,
    subject: `${items.length} ${items.length === 1 ? 'prenda nueva' : 'prendas nuevas'} de quienes sigues`,
    html: emailLayout('Nuevas prendas de tus vendedoras favoritas', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, ${items.length === 1 ? 'una vendedora que sigues publicó una prenda nueva' : `${items.length} vendedoras que sigues publicaron prendas nuevas`}:
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">${rows}</table>
      ${extra > 0 ? `<p style="font-size: 12px; color: #999; text-align: center;">+ ${extra} más</p>` : ''}
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver en Bdress Market
        </a>
      </p>
    `),
  })
}

export async function sendAdminShippingDigestEmail({
  to, awaitingDispatch, awaitingDeliveryConfirmation, awaitingReturn,
}: {
  to: string
  awaitingDispatch: { orderId: string; listingTitle: string; sellerName: string | null; daysOverdue: number }[]
  awaitingDeliveryConfirmation: { orderId: string; listingTitle: string; buyerName: string | null; trackingNumber: string | null; daysSinceShipped: number }[]
  awaitingReturn: { orderId: string; listingTitle: string; buyerName: string | null; hasLabel: boolean; trackingNumber: string | null; daysSinceApproved: number }[]
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const total = awaitingDispatch.length + awaitingDeliveryConfirmation.length + awaitingReturn.length

  const dispatchRows = awaitingDispatch.map(o => `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #444; border-bottom: 1px solid #eee;">
        <a href="${siteUrl}/admin/orders/${o.orderId}" style="color: #444;">${o.listingTitle}</a><br/>
        <span style="font-size: 11px; color: #999;">Vendedora: ${o.sellerName ?? '—'}</span>
      </td>
      <td style="padding: 8px 0; font-size: 13px; color: #c0392b; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
        ${o.daysOverdue} ${o.daysOverdue === 1 ? 'día' : 'días'} vencido
      </td>
    </tr>
  `).join('')

  const deliveryRows = awaitingDeliveryConfirmation.map(o => `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #444; border-bottom: 1px solid #eee;">
        <a href="${siteUrl}/admin/orders/${o.orderId}" style="color: #444;">${o.listingTitle}</a><br/>
        <span style="font-size: 11px; color: #999;">Compradora: ${o.buyerName ?? '—'}${o.trackingNumber ? ` · Seguimiento: ${o.trackingNumber}` : ''}</span>
      </td>
      <td style="padding: 8px 0; font-size: 13px; color: #888; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
        Despachada hace ${o.daysSinceShipped} ${o.daysSinceShipped === 1 ? 'día' : 'días'}
      </td>
    </tr>
  `).join('')

  const returnRows = awaitingReturn.map(o => `
    <tr>
      <td style="padding: 8px 0; font-size: 13px; color: #444; border-bottom: 1px solid #eee;">
        <a href="${siteUrl}/admin/orders/${o.orderId}" style="color: #444;">${o.listingTitle}</a><br/>
        <span style="font-size: 11px; color: #999;">Compradora: ${o.buyerName ?? '—'}${o.trackingNumber ? ` · Seguimiento: ${o.trackingNumber}` : ''}</span>
      </td>
      <td style="padding: 8px 0; font-size: 13px; color: #888; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
        ${o.hasLabel ? `Esperando entrega hace ${o.daysSinceApproved} ${o.daysSinceApproved === 1 ? 'día' : 'días'}` : 'Falta subir la etiqueta'}
      </td>
    </tr>
  `).join('')

  await sendEmail({
    to,
    subject: `${total} ${total === 1 ? 'orden necesita' : 'órdenes necesitan'} tu revisión — despacho/entrega/devolución`,
    html: emailLayout('Órdenes que necesitan tu revisión', `
      ${awaitingDispatch.length > 0 ? `
        <p style="font-size: 13px; color: #444; font-weight: 600; margin-bottom: 4px;">
          Pagadas, plazo de despacho vencido (${awaitingDispatch.length})
        </p>
        <p style="font-size: 12px; color: #888; line-height: 1.5; margin-top: 0;">
          Revisa si la vendedora ya despachó de verdad (por fuera de la app) y usa "Marcar como despachada" si corresponde.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${dispatchRows}</table>
      ` : ''}
      ${awaitingDeliveryConfirmation.length > 0 ? `
        <p style="font-size: 13px; color: #444; font-weight: 600; margin-bottom: 4px;">
          Despachadas, sin confirmación de la compradora (${awaitingDeliveryConfirmation.length})
        </p>
        <p style="font-size: 12px; color: #888; line-height: 1.5; margin-top: 0;">
          Revisa el seguimiento del courier y usa "Marcar como entregada" con la fecha real si ya llegó.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${deliveryRows}</table>
      ` : ''}
      ${awaitingReturn.length > 0 ? `
        <p style="font-size: 13px; color: #444; font-weight: 600; margin-bottom: 4px;">
          Devoluciones en curso (${awaitingReturn.length})
        </p>
        <p style="font-size: 12px; color: #888; line-height: 1.5; margin-top: 0;">
          Si falta la etiqueta, súbela. Si ya está en camino, revisa el seguimiento y usa "Devolución recibida" cuando la vendedora la reciba.
        </p>
        <table style="width: 100%; border-collapse: collapse;">${returnRows}</table>
      ` : ''}
    `),
  })
}

// Disputa resuelta a favor de la compradora — admin/orders/[id]/resolve,
// acción 'refund'. Antes esta rama no avisaba a nadie por correo (a
// diferencia de 'release', que sí); esto lo cierra con el mismo patrón.
export async function sendOrderRefundedEmail({
  to, name, listingTitle, role,
}: { to: string; name: string | null; listingTitle: string; role: 'buyer' | 'seller' }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const dashboardPath = role === 'buyer' ? '/dashboard/purchases' : '/dashboard/sales'
  const subject = role === 'buyer' ? `Te reembolsamos tu compra — ${listingTitle}` : `Se anuló tu venta — ${listingTitle}`
  const intro = role === 'buyer'
    ? `Hola ${name ?? ''}, revisamos tu reporte sobre <strong>${listingTitle}</strong> y te reembolsamos el pago completo.`
    : `Hola ${name ?? ''}, revisamos el reporte de la compradora sobre <strong>${listingTitle}</strong> y decidimos reembolsarle el pago — esta venta se anula, no vas a recibir el pago por ella.`

  await sendEmail({
    to,
    subject,
    html: emailLayout('Reembolso procesado', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">${intro}</p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}${dashboardPath}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi ${role === 'buyer' ? 'compra' : 'venta'}
        </a>
      </p>
    `),
  })
}

// Admin aprobó la devolución (api/admin/orders/[id]/approve-return) — el
// reembolso queda retenido hasta que la prenda vuelva a manos de la
// vendedora. Deja explícito desde el primer correo que el reembolso no es
// inmediato, para que la compradora no se sorprenda si no ve la plata al toque.
export async function sendReturnApprovedEmail({
  to, name, listingTitle,
}: { to: string; name: string | null; listingTitle: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to,
    subject: `Aprobamos tu devolución — ${listingTitle}`,
    html: emailLayout('Devolución aprobada', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, revisamos tu reporte sobre <strong>${listingTitle}</strong> y aprobamos la devolución.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        En breve te enviamos la etiqueta para devolver la prenda — el envío de vuelta corre por cuenta de Bdress,
        no tienes que pagar nada. Apenas la vendedora la reciba, te reembolsamos el pago completo.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/dashboard/purchases" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi compra
        </a>
      </p>
    `),
  })
}

// Etiqueta de devolución lista (api/admin/orders/[id]/return-label) — mismo
// patrón que sendLabelReadyEmail (etiqueta de ida a la vendedora), pero acá
// la destinataria es la compradora y el link apunta directo al archivo
// subido (sin el wrapper de /label/download que sí tiene la etiqueta de
// ida, porque no hace falta registrar cuándo la descarga).
export async function sendReturnLabelReadyEmail({
  to, name, listingTitle, labelUrl, trackingNumber, carrierInstructions,
}: {
  to: string; name: string | null; listingTitle: string
  labelUrl: string; trackingNumber: string; carrierInstructions: string
}) {
  await sendEmail({
    to,
    subject: `Tu etiqueta de devolución está lista — ${listingTitle}`,
    html: emailLayout('Etiqueta de devolución lista', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, ya puedes devolver <strong>${listingTitle}</strong>.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        ${carrierInstructions}
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        N.º de seguimiento: <strong style="font-family: monospace;">${trackingNumber}</strong>
      </p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${labelUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Descargar etiqueta
        </a>
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Apenas la vendedora reciba el paquete, te reembolsamos el pago completo.
      </p>
    `),
  })
}

// La amiga invitada publicó su primera prenda y el bono ya se acreditó
// (cron/referral-rewards) — deja explícito desde el asunto que es Crédito
// B-Dress, no plata retirable, para no generar la expectativa equivocada.
export async function sendReferralBonusEmail({
  to, name, referredName,
}: { to: string; name: string | null; referredName: string | null }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to,
    subject: `Ganaste $${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')} de Crédito B-Dress 💚`,
    html: emailLayout('Bono por invitar a una amiga', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, ${referredName ? `<strong>${referredName}</strong>` : 'tu amiga'} ya publicó su primera
        prenda en Bdress Market — como la invitaste tú, te acreditamos
        <strong>$${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')} de Crédito B-Dress</strong>.
      </p>
      <p style="font-size: 13px; color: #888; line-height: 1.6;">
        Este crédito es promocional: sirve para pagar tu próxima compra en Bdress Market, pero no se puede
        transferir a tu cuenta bancaria ni canjear por dinero.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/dashboard/wallet" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi saldo
        </a>
      </p>
    `),
  })
}

// Anuncio único del programa de referidos a vendedoras actuales (tienen al
// menos una prenda publicada) — se dispara una sola vez desde
// cron/announce-referral-program, fijado a una fecha puntual en
// vercel.json (no es un cron recurrente). El link ya viene armado con el
// código de la destinataria (ensureReferralCode ya se llamó antes de armar
// este correo) para que pueda copiarlo y compartirlo directo desde el
// celular, sin tener que entrar primero al sitio.
export async function sendReferralProgramAnnouncementEmail({
  to, name, referralLink,
}: { to: string; name: string | null; referralLink: string }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to,
    subject: 'Nuevo: invita a una amiga y gana $5.000 💚',
    html: emailLayout('Invita y gana', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tenemos algo nuevo: ahora puedes ganar <strong>$${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')}
        de Crédito B-Dress</strong> por cada amiga que invites a vender en Bdress Market.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Le compartes tu link, ella se registra y publica su primera prenda — apenas la publique, el crédito
        queda acreditado en tu cuenta, listo para usar en tu próxima compra.
      </p>
      <div style="background: #f7f7f5; padding: 16px; margin: 20px 0; text-align: center;">
        <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 8px;">
          Tu link de invitación
        </p>
        <p style="font-size: 13px; color: #333; word-break: break-all; margin: 0;">${referralLink}</p>
      </div>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/dashboard/referrals" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi link e invitar
        </a>
      </p>
      <p style="font-size: 12px; color: #888; line-height: 1.6; margin-top: 20px;">
        Este crédito es promocional: sirve para comprar en Bdress Market, pero no se puede transferir ni
        retirar en dinero. Máximo 5 amigas premiadas por mes.
      </p>
    `),
  })
}

// Anuncio único a cuentas sin activar (auth.users.last_sign_in_at nulo —
// mismo criterio que ya usa /admin/users, ver la columna "Activó cuenta"
// ahí) — se dispara desde cron/announce-activation-referral, fijado a una
// fecha puntual en vercel.json, igual que announce-referral-program. A
// diferencia de sendActivateAccountEmail/sendManualAccountWelcomeEmail (que
// asumen un origen específico — migración o creación manual desde admin),
// este correo es genérico a propósito porque la audiencia acá se define
// solo por "nunca inició sesión", sin importar cómo se creó la cuenta — y
// suma, en el mismo correo, el aviso del programa de referidos para que lo
// primero que sepa una cuenta recién activada sea que también puede ganar
// crédito invitando a una amiga.
export async function sendActivateAccountWithReferralEmail({
  to, name,
}: { to: string; name: string | null }) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

  await sendEmail({
    to,
    subject: 'Activa tu cuenta en Bdress Market — y de paso, invita y gana $5.000',
    html: emailLayout('Activa tu cuenta', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, todavía no has activado tu cuenta en Bdress Market.
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        <strong>Para activarla:</strong>
      </p>
      <ol style="font-size: 14px; color: #444; line-height: 1.8; padding-left: 20px;">
        <li>Entra a bdressmarket.cl y haz clic en "¿Olvidaste tu contraseña?" con
          tu correo (${to}) para crear tu contraseña — es tu primera vez entrando.</li>
        <li>Una vez dentro, ya puedes explorar prendas o publicar la tuya — vender es
          <strong>100% gratis</strong>, sin comisión.</li>
      </ol>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/auth/forgot-password" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Activar mi cuenta
        </a>
      </p>
      <p style="font-size: 14px; color: #444; line-height: 1.6; margin-top: 28px; padding-top: 20px; border-top: 1px solid #eee;">
        Ah, y una vez adentro: puedes invitar a una amiga a vender en Bdress Market y ganar
        <strong>$${REFERRAL_REWARD_AMOUNT.toLocaleString('es-CL')} de Crédito B-Dress</strong> cuando ella publique
        su primera prenda — lo encuentras en "Invita y gana" dentro de tu cuenta.
      </p>
    `),
  })
}

// Confirmación a la vendedora de que su pago del boost se aprobó — hasta
// ahora payment/confirm/route.ts (rama "boost:") no avisaba a nadie, solo
// actualizaba listing_boosts y featured_until en silencio.
export async function sendBoostConfirmedEmail({
  to,
  name,
  listingTitle,
  listingId,
  featuredUntil,
}: {
  to: string
  name: string | null
  listingTitle: string
  listingId: string
  featuredUntil: Date
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const untilFmt = featuredUntil.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' })

  await sendEmail({
    to,
    subject: `Tu prenda ya está destacada — ${listingTitle}`,
    html: emailLayout('¡Ya está destacada!', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, recibimos tu pago de <strong>$${BOOST_PRICE.toLocaleString('es-CL')}</strong> por destacar
        <strong>${listingTitle}</strong>. Va a aparecer en la fila "Destacadas" arriba del catálogo hasta el
        <strong>${untilFmt}</strong> (${BOOST_DURATION_DAYS} días), sin importar cómo la gente ordene o filtre.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/listings/${listingId}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver mi prenda
        </a>
      </p>
    `),
  })
}

// Aviso a ADMIN_EMAIL de cada boost pagado — mismo patrón que
// sendWalletAlertEmail (src/lib/wallet.ts), pero informativo, no de error.
export async function sendAdminBoostPaidEmail({
  listingTitle,
  listingId,
  sellerName,
  amount,
}: {
  listingTitle: string
  listingId: string
  sellerName: string | null
  amount: number
}) {
  if (!process.env.ADMIN_EMAIL) return
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    subject: `Destacado pagado — ${listingTitle} ($${amount.toLocaleString('es-CL')})`,
    html: emailLayout('Nuevo destacado pagado', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        <strong>${sellerName ?? 'Una vendedora'}</strong> pagó <strong>$${amount.toLocaleString('es-CL')}</strong>
        por destacar <strong>${listingTitle}</strong>.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/listings/${listingId}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Ver la prenda
        </a>
      </p>
    `),
  })
}

// Recordatorio único (cron boost-reminder) a vendedoras con una prenda
// activa hace rato que nunca destacaron — ver
// listings.boost_reminder_sent_at (migración 20260831000000).
export async function sendBoostReminderEmail({
  to,
  name,
  listingTitle,
  listingId,
}: {
  to: string
  name: string | null
  listingTitle: string
  listingId: string
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  await sendEmail({
    to,
    subject: `Dale más visibilidad a "${listingTitle}"`,
    html: emailLayout('Hazla más visible', `
      <p style="font-size: 14px; color: #444; line-height: 1.6;">
        Hola ${name ?? ''}, tu prenda <strong>${listingTitle}</strong> lleva un tiempo publicada. Por
        <strong>$${BOOST_PRICE.toLocaleString('es-CL')}</strong> puedes destacarla ${BOOST_DURATION_DAYS} días en la fila
        "Destacadas" arriba del catálogo, sin importar cómo la gente ordene o filtre — más ojos, más chances de vender.
      </p>
      <p style="text-align: center; margin-top: 24px;">
        <a href="${siteUrl}/listings/${listingId}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
          Destacar mi prenda
        </a>
      </p>
    `),
  })
}
