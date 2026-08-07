'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BrandOption {
  id: string
  display_name: string
}

export default function BrandActions({
  brand, allBrands,
}: {
  brand: BrandOption & { slug: string }
  allBrands: BrandOption[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mergeTarget, setMergeTarget] = useState('')

  async function rename() {
    const next = prompt('Nuevo nombre visible:', brand.display_name)
    if (!next || !next.trim() || next.trim() === brand.display_name) return
    setLoading(true)
    const res = await fetch(`/api/admin/brands/${brand.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: next.trim() }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Error al renombrar')
    }
    router.refresh()
    setLoading(false)
  }

  async function addAlias() {
    const alias = prompt('Nueva grafía a reconocer (alias) para esta marca:')
    if (!alias || !alias.trim()) return
    setLoading(true)
    const res = await fetch(`/api/admin/brands/${brand.id}/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: alias.trim() }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Error al agregar el alias')
    }
    router.refresh()
    setLoading(false)
  }

  async function merge() {
    if (!mergeTarget) return
    const targetName = allBrands.find(b => b.id === mergeTarget)?.display_name ?? ''
    if (!confirm(`¿Fusionar "${brand.display_name}" dentro de "${targetName}"? Todas sus prendas y alias pasan a "${targetName}", y "${brand.display_name}" se elimina. Esta acción no se puede deshacer.`)) return
    setLoading(true)
    const res = await fetch('/api/admin/brands/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: brand.id, targetId: mergeTarget }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Error al fusionar')
    }
    router.refresh()
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={rename} disabled={loading} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50">
          Renombrar
        </button>
        <button onClick={addAlias} disabled={loading} className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50">
          + Alias
        </button>
      </div>
      {allBrands.length > 0 && (
        <div className="flex items-center gap-1.5">
          <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)}
            className="text-[10px] border border-gray-200 px-1.5 py-1 bg-white max-w-[140px]">
            <option value="">Fusionar con…</option>
            {allBrands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
          <button onClick={merge} disabled={loading || !mergeTarget} className="text-[10px] tracking-widest uppercase text-red-500 hover:text-red-700 disabled:opacity-30">
            Fusionar
          </button>
        </div>
      )}
    </div>
  )
}
