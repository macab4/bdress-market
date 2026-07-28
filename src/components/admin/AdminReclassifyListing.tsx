'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CategoryPicker, { type CategoryPickerValue } from '@/components/listings/CategoryPicker'
import { CategoryValue } from '@/lib/catalog'

interface Props {
  listingId: string
  department: CategoryValue
  productCategory: string | null
  productType: string | null
}

export default function AdminReclassifyListing({ listingId, department, productCategory, productType }: Props) {
  const router = useRouter()
  const [value, setValue] = useState<CategoryPickerValue>({
    department,
    productCategory: productCategory ?? '',
    productType: productType ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    if (!value.productCategory || !value.productType) {
      setError('Elige categoría y tipo de producto completos')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_category: value.productCategory,
        product_type: value.productType,
        pending_review: false,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'No se pudo guardar')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <CategoryPicker
        mode="form"
        value={value}
        onChange={setValue}
        triggerClassName="border border-gray-200 px-2 py-1.5 text-xs bg-white hover:border-gray-400"
        triggerLabel="Elegir categoría"
      />
      <button type="button" onClick={save} disabled={loading}
        className="text-[10px] tracking-widest uppercase text-white bg-[#7fab87] hover:bg-[#6f9678] px-3 py-1.5 disabled:opacity-50">
        {loading ? '...' : 'Guardar'}
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
