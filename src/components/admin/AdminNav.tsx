import Link from 'next/link'

const TABS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/listings', label: 'Prendas' },
  { href: '/admin/users', label: 'Usuarias' },
  { href: '/admin/disputes', label: 'Disputas' },
  { href: '/admin/messages', label: 'Mensajes' },
  { href: '/admin/shipments', label: 'Envíos' },
  { href: '/admin/analytics', label: 'Monitoreo' },
]

export default function AdminNav({ active }: { active: string }) {
  return (
    <div className="flex gap-6 border-b border-gray-200 mb-8">
      {TABS.map(tab => (
        <Link key={tab.href} href={tab.href}
          className={`text-xs tracking-widest uppercase pb-3 ${
            active === tab.href ? 'text-black border-b-2 border-black' : 'text-gray-400 hover:text-black'
          }`}>
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
