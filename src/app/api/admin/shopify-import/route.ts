import { createClient } from '@/lib/supabase/server'

const SHOPIFY_API_VERSION = '2024-10'
const MAX_PHOTOS = 8

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function extractProductId(url: string): string | null {
  const match = url.match(/products\/(\d+)/)
  return match ? match[1] : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Trae título/descripción/marca/precio/fotos de un producto de Shopify
// (b-dress-shop) a partir de la URL de su admin, para precargar el form de
// /admin/listings/new — ver "Importar desde Shopify" en AdminListingForm.
// La admin sigue eligiendo a mano categoría/talla/color/envío porque la
// taxonomía de Shopify no tiene ninguna correspondencia confiable con la
// nuestra.
export async function POST(request: Request) {
  const user = await checkAdmin()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  if (!shopDomain || !accessToken) {
    return Response.json({ error: 'Falta configurar SHOPIFY_SHOP_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN' }, { status: 500 })
  }

  let body: { url?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.url !== 'string' || !body.url.trim()) {
    return Response.json({ error: 'Falta la URL del producto' }, { status: 400 })
  }

  const productId = extractProductId(body.url)
  if (!productId) {
    return Response.json({ error: 'No se encontró un ID de producto en esa URL' }, { status: 400 })
  }

  let shopifyRes: Response
  try {
    shopifyRes = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } }
    )
  } catch {
    return Response.json({ error: 'No se pudo conectar con Shopify' }, { status: 502 })
  }

  if (!shopifyRes.ok) {
    const detail = shopifyRes.status === 404 ? 'No se encontró ese producto en Shopify' : `Error de Shopify (${shopifyRes.status})`
    return Response.json({ error: detail }, { status: 502 })
  }

  const data = await shopifyRes.json()
  const product = data?.product
  if (!product) {
    return Response.json({ error: 'Respuesta inesperada de Shopify' }, { status: 502 })
  }

  const photos: string[] = Array.isArray(product.images)
    ? product.images.map((img: { src?: string }) => img.src).filter((src: unknown): src is string => typeof src === 'string').slice(0, MAX_PHOTOS)
    : []

  const firstVariant = Array.isArray(product.variants) ? product.variants[0] : null
  const price = firstVariant?.price ? Math.round(Number(firstVariant.price)) : null

  return Response.json({
    title: typeof product.title === 'string' ? product.title : '',
    description: typeof product.body_html === 'string' ? stripHtml(product.body_html) : '',
    brand: typeof product.vendor === 'string' ? product.vendor : '',
    price,
    photos,
  })
}
