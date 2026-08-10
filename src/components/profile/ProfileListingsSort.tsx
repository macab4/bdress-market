'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'precio_asc', label: 'Precio: menor a mayor' },
  { value: 'precio_desc', label: 'Precio: mayor a menor' },
] as const

export default function ProfileListingsSort({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const usp = new URLSearchParams(searchParams.toString())
    if (value === 'recientes') usp.delete('sort')
    else usp.set('sort', value)
    const qs = usp.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <select
      value={current}
      onChange={e => handleChange(e.target.value)}
      className="border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none"
    >
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
