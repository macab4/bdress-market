import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VISITOR_COOKIE = 'bdress_vid'
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 año

export const config = {
  matcher: ['/((?!_next/static|_next/image|api|admin|favicon.ico|logo|robots.txt|sitemap.xml).*)'],
}

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const response = NextResponse.next()

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    response.cookies.set(VISITOR_COOKIE, visitorId, { maxAge: VISITOR_COOKIE_MAX_AGE, path: '/', sameSite: 'lax' })
  }

  // waitUntil deja que el insert termine en segundo plano sin demorar la
  // respuesta ni cortarse cuando el runtime del edge la da por cerrada.
  event.waitUntil(
    logPageView({
      path: request.nextUrl.pathname,
      visitorId,
      country: request.headers.get('x-vercel-ip-country'),
      region: request.headers.get('x-vercel-ip-country-region'),
      city: request.headers.get('x-vercel-ip-city'),
    })
  )

  return response
}

async function logPageView(params: { path: string; visitorId: string; country: string | null; region: string | null; city: string | null }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const admin = createClient(url, key, { auth: { persistSession: false } })
  await admin.from('page_views').insert({
    path: params.path,
    visitor_id: params.visitorId,
    country: params.country ? decodeURIComponent(params.country) : null,
    region: params.region ? decodeURIComponent(params.region) : null,
    city: params.city ? decodeURIComponent(params.city) : null,
  })
}
