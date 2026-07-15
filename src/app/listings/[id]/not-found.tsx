import Link from 'next/link'

export default function ListingNotFound() {
  return (
    <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-4">404</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-3">Prenda no encontrada</h1>
        <p className="text-sm text-gray-500 mb-6">Es posible que esta prenda ya haya sido vendida o eliminada.</p>
        <Link href="/" className="bg-[#7fab87] text-white text-xs tracking-widest uppercase px-6 py-3 hover:bg-[#6f9678] transition">
          Ver todas las prendas
        </Link>
      </div>
    </div>
  )
}
