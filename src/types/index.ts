export type ListingCategory = 'mujer' | 'hombre' | 'ninos' | 'unisex'
export type ListingCondition = 'nuevo_con_etiquetas' | 'nuevo_sin_etiquetas' | 'muy_bueno' | 'bueno' | 'satisfactorio'
export type ListingShippingSize = 'pequeno' | 'mediano' | 'grande'
export type ListingStatus = 'active' | 'sold' | 'paused'
export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'delivered' | 'completed' | 'disputed' | 'cancelled'

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
  condition: ListingCondition
  shipping_size: ListingShippingSize
  price: number
  photos: string[]
  status: ListingStatus
  created_at: string
  seller?: Profile
}

export interface Order {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  amount: number
  commission: number
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
  paid_at: string | null
  shipped_at: string | null
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
  created_at: string
  sender?: Profile
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
