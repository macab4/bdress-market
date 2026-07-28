'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { describeSearchParams } from '@/lib/catalog'

export default function SaveSearchButton() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save() {
    if (state === 'saving' || state === 'saved') return
    setState('saving')
    const params = searchParams.toString()
    const label = describeSearchParams(searchParams)
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, label }),
    })
    setState(res.ok ? 'saved' : 'error')
  }

  return (
    <button type="button" onClick={save} disabled={state === 'saving' || state === 'saved'}
      className="text-[10px] tracking-widest uppercase text-gray-500 hover:text-black disabled:opacity-50 flex-shrink-0">
      {state === 'saved' ? '✓ Guardada' : state === 'saving' ? 'Guardando...' : state === 'error' ? 'Error, reintentar' : 'Guardar búsqueda'}
    </button>
  )
}
