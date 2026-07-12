import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'Bdress Market',
  description: 'Compra y vende prendas de la comunidad Bdress',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#EBEBEB]">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="bg-black text-gray-500 text-center py-6 text-[10px] tracking-widest uppercase">
          Bdress Market · Santiago, Chile
        </footer>
      </body>
    </html>
  )
}
