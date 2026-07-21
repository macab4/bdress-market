import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import MobileTabBar from '@/components/layout/MobileTabBar'
import AuthHashHandler from '@/components/layout/AuthHashHandler'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

export const metadata: Metadata = {
  title: 'Bdress Market',
  description: 'Compra y vende prendas de la comunidad Bdress',
  openGraph: {
    title: 'Bdress Market',
    description: 'Compra y vende prendas de la comunidad Bdress',
    url: SITE_URL,
    images: SITE_URL ? [{ url: `${SITE_URL}/logo.png`, width: 256, height: 85 }] : undefined,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Bdress Market',
    description: 'Compra y vende prendas de la comunidad Bdress',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#EBEBEB]">
        <AuthHashHandler />
        <Navbar />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <footer className="bg-black text-gray-500 text-center pt-6 pb-20 md:py-6 text-[10px] tracking-widest uppercase space-y-2">
          <p>Bdress Market · Santiago, Chile</p>
          <p className="space-x-4">
            <Link href="/nosotros" className="hover:text-white">Quiénes somos</Link>
            <Link href="/terminos" className="hover:text-white">Términos y condiciones</Link>
            <Link href="/contacto" className="hover:text-white">Contacto</Link>
            <a href="https://www.bdress.cl" target="_blank" rel="noopener noreferrer" className="hover:text-white">
              B-dress Arriendo
            </a>
          </p>
        </footer>
        <MobileTabBar />
      </body>
    </html>
  )
}
