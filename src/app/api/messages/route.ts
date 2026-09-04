import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import { moderateMessage, MODERATION_MESSAGE, REPEAT_OFFENDER_THRESHOLD, repeatOffenderMessage } from '@/lib/messageModeration'
import {
  ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENTS_PER_MESSAGE, MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES, MAX_VIDEOS_PER_MESSAGE, isVideoMime,
} from '@/lib/chatAttachments'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!
const MAX_LENGTH = 2000

type IncomingAttachment = { storage_path: string; mime_type: string; size_bytes: number }

function describeAttachments(attachments: IncomingAttachment[]): string {
  const videos = attachments.filter(a => isVideoMime(a.mime_type)).length
  const photos = attachments.length - videos
  if (videos > 0 && photos > 0) return `Te mandó ${photos} ${photos === 1 ? 'foto' : 'fotos'} y un video`
  if (videos > 0) return 'Te mandó un video'
  return photos === 1 ? 'Te mandó una foto' : `Te mandó ${photos} fotos`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticada' }, { status: 401 })

  let listingId: string
  let receiverId: string
  let content: string
  let attachments: IncomingAttachment[]
  try {
    const body = await request.json()
    listingId = body.listing_id
    receiverId = body.receiver_id
    content = String(body.content ?? '').trim()
    attachments = Array.isArray(body.attachments) ? body.attachments : []
    if (!listingId || !receiverId) throw new Error()
    if (!content && attachments.length === 0) throw new Error()
    if (content.length > MAX_LENGTH) {
      return Response.json({ error: `El mensaje no puede superar los ${MAX_LENGTH} caracteres` }, { status: 400 })
    }
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return Response.json({ error: `Puedes adjuntar hasta ${MAX_ATTACHMENTS_PER_MESSAGE} archivos por mensaje` }, { status: 400 })
    }
    const videoCount = attachments.filter(a => isVideoMime(a.mime_type)).length
    if (videoCount > MAX_VIDEOS_PER_MESSAGE) {
      return Response.json({ error: `Puedes adjuntar hasta ${MAX_VIDEOS_PER_MESSAGE} video por mensaje` }, { status: 400 })
    }
    for (const a of attachments) {
      if (
        typeof a.storage_path !== 'string' || !a.storage_path ||
        !(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(a.mime_type) ||
        typeof a.size_bytes !== 'number' || a.size_bytes <= 0 ||
        a.size_bytes > (isVideoMime(a.mime_type) ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES)
      ) {
        throw new Error()
      }
    }
  } catch {
    return Response.json({ error: 'Solicitud inválida' }, { status: 400 })
  }

  if (receiverId === user.id) {
    return Response.json({ error: 'No puedes enviarte un mensaje a ti misma' }, { status: 400 })
  }

  const moderation = moderateMessage(content)
  if (moderation.blocked) {
    // No usamos el cliente normal porque message_flags no tiene policy de
    // insert para usuarias — es un registro interno, no algo que puedan leer.
    const admin = createAdminClient()
    await admin.from('message_flags').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      listing_id: listingId,
      content,
      reason: moderation.reason ?? 'unknown',
    })

    const { count } = await admin
      .from('message_flags')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id)
    const totalFlags = count ?? 1

    // A partir de la 3ª vez avisamos al equipo por correo para que revise el
    // caso con contexto — la suspensión siempre queda como decisión manual.
    if (totalFlags >= REPEAT_OFFENDER_THRESHOLD && process.env.ADMIN_EMAIL) {
      const [{ data: senderProfile }, { data: listingForEmail }] = await Promise.all([
        admin.from('profiles').select('name, email').eq('id', user.id).single(),
        admin.from('listings').select('title, seller_id').eq('id', listingId).single(),
      ])
      const buyerIdForLink = user.id === listingForEmail?.seller_id ? receiverId : user.id

      await sendEmail({
        to: process.env.ADMIN_EMAIL,
        subject: `Alerta: ${senderProfile?.name ?? 'una usuaria'} lleva ${totalFlags} intentos bloqueados`,
        html: emailLayout('Reincidencia en el chat', `
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            <strong>${senderProfile?.name ?? 'Una usuaria'}</strong> (${senderProfile?.email ?? ''}) lleva
            <strong>${totalFlags} intentos</strong> bloqueados de compartir contacto o pago fuera de la plataforma.
          </p>
          <p style="font-size: 13px; color: #666; line-height: 1.6; background: #f7f7f7; padding: 12px 16px; border-radius: 4px;">
            Último intento (${moderation.reason}) en «${listingForEmail?.title ?? 'una prenda'}»: “${content}”
          </p>
          <p style="text-align: center; margin-top: 24px;">
            <a href="${SITE_URL}/admin/messages/${listingId}/${buyerIdForLink}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
              Revisar conversación
            </a>
          </p>
        `),
      })
    }

    const userMessage = totalFlags >= REPEAT_OFFENDER_THRESHOLD
      ? repeatOffenderMessage(totalFlags)
      : MODERATION_MESSAGE

    return Response.json({ error: userMessage }, { status: 400 })
  }

  const { data: listing } = await supabase.from('listings').select('id, title, seller_id').eq('id', listingId).single()
  if (!listing) return Response.json({ error: 'Prenda no encontrada' }, { status: 404 })

  if (user.id === listing.seller_id) {
    // La vendedora solo puede responder a alguien que ya le escribió por esta prenda.
    const { data: priorMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('listing_id', listingId)
      .eq('sender_id', receiverId)
      .eq('receiver_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!priorMessage) {
      return Response.json({ error: 'Solo puedes responder a compradoras que ya te escribieron por esta prenda' }, { status: 403 })
    }
  } else if (receiverId !== listing.seller_id) {
    return Response.json({ error: 'Solo puedes escribirle a la vendedora de esta prenda' }, { status: 403 })
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: receiverId, listing_id: listingId, content })
    .select('id, created_at')
    .single()

  if (error || !message) return Response.json({ error: error?.message ?? 'Error al enviar el mensaje' }, { status: 500 })

  if (attachments.length > 0) {
    const { error: attachmentsError } = await supabase.from('message_attachments').insert(
      attachments.map(a => ({
        message_id: message.id,
        storage_path: a.storage_path,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
      }))
    )
    // Las fotos ya están subidas a Storage y el mensaje ya existe — si esto
    // falla (ej. migración de message_attachments todavía no corrida en
    // prod) no tiene sentido devolver error al remitente, el mensaje de
    // todos modos se mandó. Se loguea para poder diagnosticarlo.
    if (attachmentsError) console.error('Error al guardar adjuntos del mensaje:', attachmentsError.message)
  }

  // Antes solo se avisaba por correo — nunca creaba notificación in-app
  // (a diferencia de ofertas, que sí lo intentaban aunque venían fallando
  // por falta de policy de insert, ver migración 20260902000000).
  await supabase.from('notifications').insert({
    user_id: receiverId,
    type: 'new_message',
    actor_id: user.id,
    listing_id: listingId,
  })

  const [{ data: sender }, { data: receiver }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase.from('profiles').select('email, name').eq('id', receiverId).single(),
  ])

  if (receiver?.email) {
    await sendEmail({
      to: receiver.email,
      subject: `Nuevo mensaje de ${sender?.name || 'una usuaria'} — ${listing.title}`,
      html: emailLayout('Nuevo mensaje', `
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Hola ${receiver.name ?? ''}, ${sender?.name || 'una usuaria'} te escribió sobre <strong>${listing.title}</strong>:
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.6; background: #f7f7f7; padding: 12px 16px; border-radius: 4px;">
          ${content
            ? `“${content.length > 200 ? content.slice(0, 200) + '…' : content}”`
            : `📷 ${describeAttachments(attachments)}`
          }
        </p>
        <p style="text-align: center; margin-top: 24px;">
          <a href="${SITE_URL}/dashboard/messages/${listingId}/${user.id}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">
            Responder
          </a>
        </p>
      `),
    })
  }

  return Response.json({ ok: true, id: message.id })
}
