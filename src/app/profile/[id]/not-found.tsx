import Link from 'next/link'

export default function ProfileNotFound() {
  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-xs tracking-[6px] uppercase text-[#8DA988] mb-4">404</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-3">Perfil no encontrado</h1>
        <p className="text-sm text-gray-500 mb-6">Esta usuaria no existe o fue eliminada.</p>
        <Link href="/" className="bg-black text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-gray-800 transition">
          Ver todas las prendas
        </Link>
      </div>
    </div>
  )
}
