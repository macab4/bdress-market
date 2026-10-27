import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const STATE_COOKIE = 'shopify_oauth_state'

// Arranca el OAuth con Shopify para instalar la app "B-Dress Marketplace"
// (creada en dev.shopify.com) en b-dress-shop y obtener un Admin API access
// token — ver /api/admin/shopify-oauth/callback. Reemplaza el flujo de
// "custom app" clásico, discontinuado por Shopify desde 2026-01-01.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!shopDomain || !clientId || !siteUrl) {
    return Response.json({ error: 'Falta configurar SHOPIFY_SHOP_DOMAIN / SHOPIFY_CLIENT_ID / NEXT_PUBLIC_SITE_URL' }, { status: 500 })
  }

  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' })

  const redirectUri = `${siteUrl}/api/admin/shopify-oauth/callback`
  const authorizeUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`)
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('scope', 'read_products')
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)

  return Response.redirect(authorizeUrl.toString(), 302)
}
