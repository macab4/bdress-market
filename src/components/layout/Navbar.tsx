import Link from 'next/link'
import Image from 'next/image'
import { Heart, MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let unreadCount = 0
  if (user) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', user.id)
      .is('read_at', null)
    unreadCount = count ?? 0
  }

  return (
    <nav className="bg-white border-b border-gray-100 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="Bdress Market" width={160} height={53} priority className="h-9 w-auto" />
        </Link>

        <div className="hidden md:flex items-center gap-6">
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
              <Link href="/dashboard/offers" className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Mis ofertas
              </Link>
              <Link href="/dashboard/messages" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                <MessageCircle size={14} />
                Mensajes
                {unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#5a7a55] text-white text-[9px] flex items-center justify-center normal-case tracking-normal">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/favorites" aria-label="Favoritos" className="text-gray-500 hover:text-black">
                <Heart size={18} />
              </Link>
              <Link href={`/profile/${user.id}`} className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                Mi perfil
              </Link>
              {user.email === process.env.ADMIN_EMAIL && (
                <Link href="/admin" className="text-xs text-gray-500 hover:text-black tracking-widest uppercase">
                  Admin
                </Link>
              )}
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
