'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/trackEvent'

// Único lugar que decide a dónde manda el CTA de vender según el estado de
// sesión — si no está logueada, pasa primero por login/registro con
// ?next=/listings/new para que vuelva derecho al formulario de publicación
// en vez de perderse en el home (ver auth/login y auth/register page.tsx).
interface Props {
  isLoggedIn: boolean
  eventName: string
  className?: string
  children: React.ReactNode
}

export default function TrackedSellLink({ isLoggedIn, eventName, className, children }: Props) {
  return (
    <Link
      href={isLoggedIn ? '/listings/new' : '/auth/login?next=/listings/new'}
      onClick={() => trackEvent(eventName)}
      className={className}
    >
      {children}
    </Link>
  )
}
