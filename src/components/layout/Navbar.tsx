import Link from 'next/link'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-sm font-light tracking-[4px] uppercase">
          Bdress Market
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link href="/listings/new"
                className="bg-black text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-gray-800 transition">
                + Vender
              </Link>
              <Link href="/dashboard/sales" className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Mis ventas
              </Link>
              <Link href="/dashboard/purchases" className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Mis compras
              </Link>
              <Link href="/favorites" aria-label="Favoritos" className="text-gray-500 hover:text-black">
                <Heart size={18} />
              </Link>
              <Link href={`/profile/${user.id}`} className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Mi perfil
              </Link>
              <form action="/auth/signout" method="POST">
                <button className="text-xs text-gray-400 hover:text-black tracking-widest uppercase">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Ingresar
              </Link>
              <Link href="/auth/register"
                className="bg-black text-white text-[10px] tracking-widest uppercase px-4 py-2 hover:bg-gray-800 transition">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
