import TrackedSellLink from './TrackedSellLink'

// Barra delgada arriba del hero — refuerza "también puedes vender" para
// quien entra por primera vez (Instagram/WhatsApp) antes de que tenga que
// leer nada más. Mensaje estático a propósito (ver encargo: un carrusel acá
// es opcional, no obligatorio, y esto es más simple/robusto).
export default function SellAnnouncementBar({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <TrackedSellLink
      isLoggedIn={isLoggedIn}
      eventName="click_home_sell_banner"
      className="block bg-[#7fab87] text-white text-center py-2 px-4 text-[11px] sm:text-xs tracking-wide hover:bg-[#6f9678] transition"
    >
      ¿Tienes ropa o accesorios que ya no usas? Véndelos en B-Dress Market — 0% comisión* →
    </TrackedSellLink>
  )
}
