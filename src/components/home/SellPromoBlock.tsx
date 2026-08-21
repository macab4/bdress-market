import { PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED } from '@/lib/catalog'
import TrackedSellLink from './TrackedSellLink'

const STEPS = ['Crea tu cuenta', 'Publica tu prenda', 'Vende de forma segura']

// Bloque breve dentro del home (sección "¿Tienes algo para vender?" del
// encargo) — solo en la vista por defecto del catálogo (ver isDefaultView en
// page.tsx), para no repetirlo en cada búsqueda/filtro.
export default function SellPromoBlock({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-12">
      <div className="bg-white p-6 sm:p-8 text-center">
        <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">¿Tienes algo para vender?</p>
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
          Cualquier persona puede vender en B-Dress Market — no necesitas haber comprado antes.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2 max-w-md mx-auto mb-6">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:text-center sm:gap-1.5">
              <span className="text-base font-light text-[#7fab87] sm:text-xl">{i + 1}</span>
              <p className="text-xs text-gray-600 sm:leading-tight">{step}</p>
            </div>
          ))}
        </div>

        <p className="text-sm font-medium text-[#5a7a55] mb-5">0% comisión por vender*</p>

        <TrackedSellLink
          isLoggedIn={isLoggedIn}
          eventName="click_home_sell_how_it_works"
          className="inline-block bg-[#7fab87] text-white text-xs tracking-widest uppercase px-8 py-3 hover:bg-[#6f9678] transition"
        >
          Empezar a vender
        </TrackedSellLink>

        <p className="text-[10px] text-gray-400 leading-relaxed mt-5 max-w-sm mx-auto">
          *Solo se descuenta el costo de procesamiento de pago ({Math.round(PROCESSING_FEE_PCT * 100)}% + ${PROCESSING_FEE_FIXED}) cuando se concreta una venta.
        </p>
      </div>
    </section>
  )
}
