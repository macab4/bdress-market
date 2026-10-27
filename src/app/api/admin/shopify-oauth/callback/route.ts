import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const STATE_COOKIE = 'shopify_oauth_state'

function verifyHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get('hmac')
  if (!hmac) return false

  const message = Array.from(params.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const digest = createHmac('sha256', secret).update(message).digest('hex')
  const a = Buffer.from(digest)
  const b = Buffer.from(hmac)
  return a.length === b.length && timingSafeEqual(a, b)
}

function htmlResponse(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:system-ui;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6}
    code{background:#f1f1f1;padding:2px 6px;display:inline-block;word-break:break-all}</style>
    </head><body><h2>${title}</h2>${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

// Recibe la vuelta del OAuth de Shopify (ver /api/admin/shopify-oauth/start),
// valida el hmac y el state, intercambia el "code" por un Admin API access
// token, y lo muestra para copiarlo a SHOPIFY_ADMIN_ACCESS_TOKEN — mismo
// patrón que el resto de las credenciales del proyecto (env var, no se
// guarda en la base de datos).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  if (!clientId || !clientSecret || !shopDomain) {
    return htmlResponse('Error', '<p>Falta configurar SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET / SHOPIFY_SHOP_DOMAIN.</p>', 500)
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const shop = searchParams.get('shop')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const savedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)

  if (!code || !shop) {
    return htmlResponse('Error', '<p>Faltan parámetros en la respuesta de Shopify.</p>', 400)
  }
  if (shop !== shopDomain) {
    return htmlResponse('Error', `<p>La tienda no coincide (${shop}).</p>`, 400)
  }
  if (!state || state !== savedState) {
    return htmlResponse('Error', '<p>El state no coincide — probablemente el link expiró. Volvé a intentar desde el botón "Conectar con Shopify".</p>', 400)
  }
  if (!verifyHmac(searchParams, clientSecret)) {
    return htmlResponse('Error', '<p>No se pudo verificar la firma de Shopify (hmac inválido).</p>', 400)
  }

  let tokenRes: Response
  try {
    tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    })
  } catch {
    return htmlResponse('Error', '<p>No se pudo conectar con Shopify para canjear el código.</p>', 502)
  }

  if (!tokenRes.ok) {
    return htmlResponse('Error', `<p>Shopify rechazó el intercambio de token (${tokenRes.status}).</p>`, 502)
  }

  const data = await tokenRes.json()
  const accessToken = data?.access_token
  if (!accessToken) {
    return htmlResponse('Error', '<p>Shopify no devolvió un access_token.</p>', 502)
  }

  return htmlResponse(
    'Conectado con Shopify',
    `<p>Copia este valor en <code>SHOPIFY_ADMIN_ACCESS_TOKEN</code> (en .env.local y en Vercel):</p>
     <p><code>${accessToken}</code></p>
     <p>Después de guardarlo, ya podés usar "Importar desde Shopify" en /admin/listings/new.</p>`
  )
}
