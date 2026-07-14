'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Heart, Plus, ShoppingBag, User, LogIn } from 'lucide-react'

interface Props {
  isLoggedIn: boolean
  userId?: string
}

export default function MobileTabBarClient({ isLoggedIn, userId }: Props) {
  const pathname = usePathname()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  function tabClass(active: boolean) {
    return `flex flex-col flex-1 items-center justify-center gap-0.5 py-2 text-[9px] tracking-widest uppercase ${
      active ? 'text-black' : 'text-gray-400'
    }`
  }

  const profileHref = userId ? `/profile/${userId}` : '/auth/login'

  return (
    <nav
      aria-label="Navegación principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Link href="/" className={tabClass(isActive('/'))}>
        <Home size={20} strokeWidth={isActive('/') ? 2.25 : 1.75} />
        Inicio
      </Link>

      {isLoggedIn && (
        <Link href="/favorites" className={tabClass(isActive('/favorites'))}>
          <Heart size={20} strokeWidth={isActive('/favorites') ? 2.25 : 1.75} />
          Favoritos
        </Link>
      )}

      <Link href="/listings/new" aria-label="Vender" className="flex-1 flex items-center justify-center">
        <span className="w-11 h-11 -mt-4 rounded-full bg-black text-white flex items-center justify-center shadow-lg shadow-black/25">
          <Plus size={22} />
        </span>
      </Link>

      {isLoggedIn && (
        <Link href="/dashboard/purchases" className={tabClass(isActive('/dashboard/purchases'))}>
          <ShoppingBag size={20} strokeWidth={isActive('/dashboard/purchases') ? 2.25 : 1.75} />
          Compras
        </Link>
      )}

      <Link href={profileHref} className={tabClass(isActive(profileHref))}>
        {isLoggedIn ? (
          <User size={20} strokeWidth={isActive(profileHref) ? 2.25 : 1.75} />
        ) : (
          <LogIn size={20} strokeWidth={isActive(profileHref) ? 2.25 : 1.75} />
        )}
        {isLoggedIn ? 'Perfil' : 'Ingresar'}
      </Link>
    </nav>
  )
}
