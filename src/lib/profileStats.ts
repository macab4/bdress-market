// Cálculo de reputación del perfil público — SOLO con datos reales ya
// existentes en el sistema. Cada regla está documentada acá mismo para que
// quede claro de dónde sale cada badge (ver informe entregado junto con esta
// función). Nada de esto inventa ni estima: si no hay suficiente muestra,
// simplemente no se muestra el badge.

export interface OrderTiming {
  paid_at: string | null
  shipped_at: string | null
}

export interface MessageRow {
  sender_id: string
  receiver_id: string
  listing_id: string
  created_at: string
}

const HOUR = 60 * 60 * 1000

// "Despacha rápido" — promedio de horas entre el pago y el despacho
// (orders.paid_at → orders.shipped_at), sobre las órdenes de esta vendedora
// que ya tienen ambas fechas. Exige al menos 3 despachos para no premiar un
// solo envío rápido de casualidad. Umbral: promedio ≤ 48 horas.
export function hasFastShippingBadge(orders: OrderTiming[]): boolean {
  const timed = orders
    .filter((o): o is { paid_at: string; shipped_at: string } => !!o.paid_at && !!o.shipped_at)
    .map(o => (new Date(o.shipped_at).getTime() - new Date(o.paid_at).getTime()) / HOUR)
    .filter(hours => hours >= 0)

  if (timed.length < 3) return false
  const avgHours = timed.reduce((a, b) => a + b, 0) / timed.length
  return avgHours <= 48
}

// "Responde rápido" — para cada mensaje que le mandaron a esta vendedora
// (receiver_id = ella), se busca si respondió (mismo listing, mismo par de
// usuarias) dentro de las 24 horas siguientes. Exige al menos 5 mensajes
// recibidos para tener muestra, y que al menos el 70% haya tenido respuesta
// a tiempo. Solo usa remitente/destinatario/fecha — nunca el contenido.
export function hasFastReplyBadge(messages: MessageRow[], sellerId: string): boolean {
  const received = messages.filter(m => m.receiver_id === sellerId)
  if (received.length < 5) return false

  let onTime = 0
  for (const msg of received) {
    const counterpartId = msg.sender_id
    const repliedInTime = messages.some(reply =>
      reply.sender_id === sellerId &&
      reply.receiver_id === counterpartId &&
      reply.listing_id === msg.listing_id &&
      new Date(reply.created_at).getTime() > new Date(msg.created_at).getTime() &&
      new Date(reply.created_at).getTime() - new Date(msg.created_at).getTime() <= 24 * HOUR
    )
    if (repliedInTime) onTime++
  }
  return onTime / received.length >= 0.7
}

// "Vendedora activa" — o bien tiene varias prendas activas ahora mismo, o
// publicó algo recientemente. No mide login/actividad de sesión (ese dato no
// existe de forma confiable sin agregar tracking nuevo — ver informe).
export function isActiveSeller(activeListingsCount: number, mostRecentListingCreatedAt: string | null): boolean {
  if (activeListingsCount >= 5) return true
  if (!mostRecentListingCreatedAt) return false
  const daysSincePublish = (Date.now() - new Date(mostRecentListingCreatedAt).getTime()) / (24 * HOUR)
  return daysSincePublish <= 30
}
