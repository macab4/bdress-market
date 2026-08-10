export type ListingCategory = 'mujer' | 'hombre' | 'ninos' | 'unisex'
export type ListingCondition = 'nuevo_con_etiquetas' | 'nuevo_sin_etiquetas' | 'muy_bueno' | 'bueno' | 'satisfactorio'
export type ListingColor =
  | 'negro' | 'gris' | 'blanco' | 'crema' | 'beige' | 'naranja_pastel' | 'naranja' | 'coral'
  | 'rojo' | 'burdeos' | 'rosa' | 'rosa_palido' | 'morado' | 'lila' | 'azul_claro' | 'azul'
  | 'azul_marino' | 'turquesa' | 'menta' | 'verde' | 'verde_oscuro' | 'caqui' | 'marron'
  | 'amarillo' | 'plateado' | 'dorado' | 'varios' | 'transparente'
export type ListingShippingSize = 'pequeno' | 'mediano' | 'grande'
export type ListingStatus = 'active' | 'sold' | 'paused'
export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'disputed' | 'cancelled'
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'cancelled'
export type OfferProposedBy = 'buyer' | 'seller'

// Selección internacional (prendas por encargo desde Vinted u otra
// plataforma internacional) — ver src/lib/international/.
export type SourceType = 'local' | 'international_on_demand'
export type SourcePlatform = 'vinted' | 'depop' | 'manual' | 'other'
export type SourceStatus = 'available' | 'pending_verification' | 'purchased' | 'unavailable'
export type InternationalStatus =
  | 'awaiting_source_verification' | 'source_confirmed' | 'source_purchase_pending' | 'source_purchased'
  | 'source_unavailable' | 'received_at_foreign_hub' | 'international_transit' | 'customs_processing'
  | 'received_in_chile' | 'quality_check' | 'national_shipping_pending' | 'nationally_shipped' | 'delivered'
  | 'cancellation_pending' | 'refund_pending' | 'refunded'

export interface Profile {
  id: string
  email: string
  name: string
  avatar_url: string | null
  city: string | null
  bio: string | null
  phone: string | null
  address: string | null
  comuna: string | null
  created_at: string
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  description: string
  category: ListingCategory
  subcategory: string
  size: string
  brand: string
  // Fuente de verdad de la marca — nullable a propósito mientras se
  // completa el backfill (ver src/lib/brands.ts). `brand` (texto) se
  // mantiene por compatibilidad, pero deja de ser la identidad real de la
  // marca apenas brand_id está asignado.
  brand_id: string | null
  condition: ListingCondition
  colors: ListingColor[]
  shipping_size: ListingShippingSize
  price: number
  photos: string[]
  status: ListingStatus
  created_at: string
  bumped_at: string
  featured_until: string | null
  product_category: string | null
  product_type: string | null
  length: string | null
  occasion: string[]
  season: string | null
  style: string | null
  material: string | null
  pending_review: boolean
  source_type: SourceType
  international_lead_time_min_days: number | null
  international_lead_time_max_days: number | null
  international_shipping_notes: string | null
  seller?: Profile
  brand_ref?: Brand | null
}

// Marca canónica — ver supabase/migrations/20260807000000_brand_canonical_model.sql
// y src/lib/brands.ts. `normalized_name` no es accent-insensitive a propósito
// (ver ese archivo) — nunca se usa para fusionar automáticamente.
export interface Brand {
  id: string
  display_name: string
  slug: string
  normalized_name: string
  created_at: string
  updated_at: string
}

export interface BrandAlias {
  id: string
  brand_id: string
  alias: string
  normalized_alias: string
  created_at: string
}

// Datos administrativos/sensibles de un listing internacional — 1:1 con
// Listing por listing_id. Nunca se expone en una respuesta pública ni en
// un componente cliente que no sea del panel admin.
export interface ListingSourcing {
  listing_id: string
  source_platform: SourcePlatform
  source_url: string | null
  source_listing_id: string | null
  source_original_price: number | null
  source_original_currency: string | null
  source_last_verified_at: string | null
  source_status: SourceStatus
  international_product_status: InternationalStatus | null
  international_cost_estimate: number | null
  international_customs_estimate: number | null
  international_internal_notes: string | null
  external_seller_name: string | null
  external_location: string | null
  external_purchase_price: number | null
  external_purchase_currency: string | null
  external_purchase_date: string | null
  external_order_reference: string | null
  external_tracking_number: string | null
  external_tracking_url: string | null
  content_authorization_confirmed_by: string | null
  content_authorization_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  amount: number
  commission: number
  processing_fee: number
  shipping_cost: number
  status: OrderStatus
  tracking_number: string | null
  payment_ref: string | null
  dispute_reason: string | null
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_address_extra: string
  shipping_comuna: string
  shipping_city: string
  courier_service_code: string | null
  courier_tracking_number: string | null
  courier_barcode: string | null
  label_url: string | null
  label_downloaded_at: string | null
  label_courier: string | null
  label_tracking_number: string | null
  label_uploaded_at: string | null
  last_ship_reminder_sent_at: string | null
  paid_at: string | null
  shipped_at: string | null
  confirmed_at: string | null
  completed_at: string | null
  buyer_review_reminded_at: string | null
  seller_review_reminded_at: string | null
  international_status: InternationalStatus | null
  international_terms_accepted_at: string | null
  international_terms_version: string | null
  international_user_agent: string | null
  delay_notice_sent_at: string | null
  created_at: string
  listing?: Listing
  buyer?: Profile
  seller?: Profile
}

// Fila del historial de estados internacionales tal como la ve la clienta
// (sin internal_note ni changed_by) — ver /api/orders/[id]/status-history.
export interface OrderStatusHistoryEntry {
  new_status: InternationalStatus
  public_note: string | null
  created_at: string
}

// Fila completa del historial, solo para el panel admin (createAdminClient).
export interface OrderStatusHistoryRecord extends OrderStatusHistoryEntry {
  id: string
  order_id: string
  previous_status: InternationalStatus | null
  changed_by: string | null
  internal_note: string | null
}

export interface Offer {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  original_price: number
  offered_price: number
  proposed_by: OfferProposedBy
  status: OfferStatus
  round: number
  parent_offer_id: string | null
  expires_at: string
  accepted_expires_at: string | null
  created_at: string
  listing?: Listing
  buyer?: Profile
  seller?: Profile
}

export interface Favorite {
  id: string
  user_id: string
  listing_id: string
  created_at: string
  listing?: Listing
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  listing_id: string
  content: string
  read_at: string | null
  created_at: string
  sender?: Profile
  receiver?: Profile
  listing?: Listing
}

export interface Review {
  id: string
  reviewer_id: string
  reviewed_id: string
  order_id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer?: Profile
}

export interface Follow {
  id: string
  follower_id: string
  followed_id: string
  created_at: string
}

export interface SavedSearch {
  id: string
  user_id: string
  label: string | null
  params: string
  created_at: string
}

export type NotificationType = 'new_listing'

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  actor_id: string
  listing_id: string | null
  read_at: string | null
  created_at: string
  actor?: Profile
  listing?: Listing
}
