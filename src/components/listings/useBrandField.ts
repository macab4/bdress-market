'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BrandOption } from '@/lib/brands'

// Compartido por ListingForm.tsx (vendedoras) e InternationalListingForm.tsx
// (admin) — mismo comportamiento en los dos: autocomplete contra marcas
// canónicas ya existentes, y solo se crea una marca nueva si de verdad no
// hay ninguna coincidencia exacta (ver /api/brands/resolve).
export function useBrandField(initialDisplayName: string) {
  const [brandInput, setBrandInputRaw] = useState(initialDisplayName)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [options, setOptions] = useState<BrandOption[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadBrands() {
      const supabase = createClient()
      const { data } = await supabase.from('brands').select('id, display_name, slug').order('display_name')
      if (!cancelled && data) setOptions(data)
    }
    loadBrands()
    return () => { cancelled = true }
  }, [])

  // Si lo que queda escrito coincide exacto con una marca ya cargada
  // (típicamente porque la seleccionó del datalist), ya sabemos el
  // brand_id sin necesidad de llamar al servidor.
  function setBrandInput(value: string) {
    setBrandInputRaw(value)
    const match = options.find(o => o.display_name === value)
    setBrandId(match ? match.id : null)
  }

  // Se llama al guardar. Si el texto no calzó exacto con ninguna opción
  // cargada (porque se escribió con otro formato, o es una marca nueva),
  // resuelve contra el servidor: reutiliza la marca si el texto normalizado
  // ya existe como alias, o la crea si de verdad no existe ninguna.
  async function resolveBrand(): Promise<{ id: string; display_name: string } | null> {
    const trimmed = brandInput.trim()
    if (!trimmed) return null

    const exact = options.find(o => o.display_name === trimmed)
    if (exact) return { id: exact.id, display_name: exact.display_name }

    const res = await fetch('/api/brands/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand: trimmed }),
    })
    if (!res.ok) throw new Error('No se pudo resolver la marca')
    const data = await res.json()
    return { id: data.id, display_name: data.display_name }
  }

  return { brandInput, setBrandInput, brandId, brandOptions: options, resolveBrand }
}
