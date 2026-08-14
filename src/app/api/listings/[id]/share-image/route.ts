import { createClient } from '@/lib/supabase/server'
import { generateShareCardPng } from '@/lib/shareCard'
import { INTERNATIONAL_BADGE_LABEL } from '@/lib/international/content'

export const runtime = 'nodejs'

// Tarjeta 1080x1920 para compartir una ficha (botón Compartir → ver
// ShareButton.tsx). Se genera on-demand cuando la usuaria toca Compartir, no
// en cada carga de la ficha — por eso vive en su propia ruta en vez de
// calcularse en listings/[id]/page.tsx. Cacheable en CDN porque el resultado
// es determinístico por listing (mismo id → misma imagen) hasta que la
// prenda cambie.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('title, brand, price, photos, source_type')
    .eq('id', id)
    .single()

  if (!listing) return new Response('Prenda no encontrada', { status: 404 })

  try {
    const buffer = await generateShareCardPng({
      title: listing.title,
      brand: listing.brand,
      price: listing.price,
      photos: listing.photos,
      badgeLabel: listing.source_type === 'international_on_demand' ? INTERNATIONAL_BADGE_LABEL : null,
    })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[share-image] error generando la tarjeta:', err)
    return new Response('No se pudo generar la imagen', { status: 500 })
  }
}
