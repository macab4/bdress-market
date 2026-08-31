import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient()

  const [{ data: listings }, { data: profiles }, { data: vacationSellers }] = await Promise.all([
    admin.from('listings').select('id, created_at, seller_id').eq('status', 'active'),
    admin.from('profiles').select('id, created_at'),
    admin.from('profiles').select('id').eq('vacation_mode', true),
  ])
  // El cliente admin salta la RLS que ya oculta estas prendas en el resto
  // del sitio (ver policy "Prendas activas visibles para todos") — hay que
  // filtrarlas a mano acá para no indexarlas mientras la vendedora está en
  // modo vacaciones.
  const vacationSellerIds = new Set((vacationSellers ?? []).map(p => p.id))
  const visibleListings = (listings ?? []).filter(l => !vacationSellerIds.has(l.seller_id))

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/nosotros`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/terminos`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/contacto`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const listingRoutes: MetadataRoute.Sitemap = visibleListings.map(l => ({
    url: `${SITE_URL}/listings/${l.id}`,
    lastModified: l.created_at,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map(p => ({
    url: `${SITE_URL}/profile/${p.id}`,
    lastModified: p.created_at,
    changeFrequency: 'weekly',
    priority: 0.4,
  }))

  return [...staticRoutes, ...listingRoutes, ...profileRoutes]
}
