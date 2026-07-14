import Link from 'next/link'
import SellerPriceCalculator from '@/components/SellerPriceCalculator'
import {
  sellerPayout, paymentProcessingFee, buyerProtectionFee,
  PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED, COMMISSION_PCT,
  OFFER_MIN_PCT, OFFER_MAX_ROUNDS, OFFER_EXPIRY_HOURS, OFFER_ACCEPTED_HOLD_HOURS,
} from '@/lib/catalog'

const EXAMPLE_PRICE = 100000

const SECTIONS = [
  { id: 'que-es', label: 'Qué es Bdress Market' },
  { id: 'comprar', label: 'Cómo comprar' },
  { id: 'ofertas', label: 'Ofertas y negociación' },
  { id: 'vender', label: 'Cómo vender' },
  { id: 'envios', label: 'Envíos' },
  { id: 'pagos', label: 'Pagos y comisión' },
  { id: 'mensajes', label: 'Mensajería' },
  { id: 'disputas', label: 'Devoluciones y disputas' },
  { id: 'cuentas', label: 'Cuentas y conducta' },
  { id: 'contacto', label: 'Contacto' },
]

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs tracking-[6px] uppercase text-[#8DA988] mb-3">Bdress Market</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-2">Términos y condiciones</h1>
        <p className="text-xs text-gray-400 mb-8">Última actualización: 14 de julio de 2026</p>

        {/* Menú */}
        <nav className="bg-white p-5 mb-6">
          <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-3">En esta página</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-gray-600 hover:text-black underline underline-offset-2">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section id="que-es" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Qué es Bdress Market</h2>
            <p>
              Bdress Market es una plataforma donde personas de la comunidad Bdress pueden comprar y vender prendas
              de segunda mano entre ellas. Nosotras facilitamos el pago, el cálculo del envío y la resolución de
              problemas, pero cada prenda pertenece y es publicada directamente por la persona que la vende.
            </p>
          </section>

          <section id="comprar" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Cómo comprar</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Explora las prendas disponibles y filtra por categoría, talla, estado o precio, y ordena los resultados de más recientes a más antiguas o por precio.</li>
              <li>Al entrar a una prenda que te interese, haz clic en «Comprar» e ingresa tu dirección de despacho (comuna, calle, número y depto/casa si corresponde).</li>
              <li>Antes de pagar vas a ver el precio de la prenda, la Protección BDress y el costo real de envío — se cotiza al momento según tu comuna y la de la vendedora — con el total bien claro.</li>
              <li>El pago se realiza a través de Mercado Pago (tarjetas de crédito, débito y otros medios habilitados).</li>
              <li>Una vez confirmado el pago, la vendedora recibe aviso para despachar tu prenda dentro de los próximos días.</li>
              <li>Puedes seguir el estado de tu compra en «Mis compras»: pagada → despachada → confirmada → completada.</li>
              <li>
                Cuando te llegue la prenda, confirma la recepción desde «Mis compras». Desde ese momento tienes{' '}
                <strong>2 días</strong> para reportar un problema antes de que el pago se libere a la vendedora. Si
                no confirmas nada, asumimos que todo llegó bien: la compra se marca como completada
                automáticamente a los <strong>7 días</strong> desde el despacho. Una vez completada, puedes
                dejarle una reseña a la vendedora.
              </li>
            </ol>
          </section>

          <section id="ofertas" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Ofertas y negociación</h2>
            <p className="mb-2">
              Si un precio te parece un poco alto, puedes hacerle una oferta a la vendedora en vez de pagar el
              precio publicado. Ella puede aceptarla, rechazarla o hacerte una contraoferta, y desde ahí pueden
              seguir negociando hasta llegar a un acuerdo — hasta un máximo de <strong>{OFFER_MAX_ROUNDS} rondas</strong> por
              conversación.
            </p>
            <p className="mb-2">
              La oferta mínima que se puede proponer es un <strong>{Math.round(OFFER_MIN_PCT * 100)}%</strong> del
              precio publicado. Si la otra parte no responde dentro de <strong>{OFFER_EXPIRY_HOURS} horas</strong>, la
              oferta expira automáticamente.
            </p>
            <p>
              Cuando la vendedora acepta una oferta, se genera un precio especial solo para ti: tienes{' '}
              <strong>{OFFER_ACCEPTED_HOLD_HOURS} horas</strong> para completar la compra a ese precio pactado. El
              precio publicado de la prenda no cambia para el resto de las compradoras — solo tu compra se
              beneficia del acuerdo. La Protección BDress y el resto del desglose se recalculan sobre el precio
              pactado, no sobre el precio original.
            </p>
          </section>

          <section id="vender" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Cómo vender</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Crea tu cuenta y completa tu perfil, incluyendo tu dirección de despacho (nombre, teléfono, dirección y comuna) — la vas a necesitar para generar etiquetas de envío.</li>
              <li>Publica tu prenda con fotos, título, descripción, categoría y subcategoría, talla, marca, estado (nuevo con etiquetas, nuevo sin etiquetas, muy bueno, bueno o satisfactorio), tamaño de envío y precio. Publicar es gratis y no te cobramos comisión por vender.</li>
              <li>Cuando alguien compra tu prenda, te avisamos por correo. Entra a «Mis ventas» y genera la etiqueta de envío: se genera automáticamente con Chilexpress y te llega lista para imprimir a tu correo.</li>
              <li>Imprime la etiqueta, pégala en el paquete y llévalo a cualquier sucursal de Chilexpress.</li>
              <li>
                Cuando la compradora confirma la recepción, esperamos <strong>2 días</strong> por si reporta un
                problema — si no lo hace, el pago se libera a tu favor. Si nunca confirma, asumimos que todo llegó
                bien y el pago se libera igual de forma automática a los <strong>7 días</strong> desde el despacho.
              </li>
            </ol>

            <p className="text-[10px] tracking-widest uppercase text-gray-400 mt-5 mb-2">Calcula cuánto vas a recibir</p>
            <SellerPriceCalculator />
          </section>

          <section id="envios" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Envíos</h2>
            <p className="mb-2">
              Todos los envíos de Bdress Market se realizan a través de Chilexpress. El costo se calcula en tiempo
              real según la comuna de origen (vendedora) y destino (compradora), y lo paga la compradora — se suma
              al precio de la prenda al momento de pagar.
            </p>
            <p>
              La vendedora es responsable de despachar la prenda en la sucursal Chilexpress dentro de los días
              indicados luego de recibir el pago. Si no lo hace a tiempo, la compradora puede solicitar el
              reembolso completo.
            </p>
          </section>

          <section id="pagos" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Pagos y comisión</h2>
            <p className="mb-4">
              Queremos que esto sea simple y transparente para las dos partes. Así funciona:
            </p>

            <p className="font-medium text-gray-800 mb-1">Si vendes</p>
            <p className="mb-4">
              Publicar es gratis y no te cobramos comisión por vender. Cuando se concreta una venta, solo se
              descuenta de tu pago el <strong>costo de procesamiento de la transacción</strong> ({Math.round(PROCESSING_FEE_PCT * 100)}% + ${PROCESSING_FEE_FIXED}), que
              es lo que cobra la pasarela de pago por procesar la compra — no es un cobro de Bdress.
            </p>

            <p className="font-medium text-gray-800 mb-1">Si compras</p>
            <p className="mb-4">
              Pagas el precio que fijó la vendedora más un <strong>{Math.round(COMMISSION_PCT * 100)}% de Protección BDress</strong>, ya con todo
              incluido. Esta tarifa te permite pagar de forma segura, incluye seguimiento de tu envío y soporte de
              nuestro equipo si algo sale mal — y siempre la vas a ver reflejada en el precio final antes de pagar,
              nunca como un cargo sorpresa en el último paso.
            </p>

            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Ejemplo con una prenda de ${EXAMPLE_PRICE.toLocaleString('es-CL')}</p>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="bg-gray-50 p-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Compradora paga</p>
                <div className="flex justify-between text-xs mb-1"><span>Precio del vestido</span><span>${EXAMPLE_PRICE.toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between text-xs mb-1"><span>Protección BDress ({Math.round(COMMISSION_PCT * 100)}%)</span><span>${buyerProtectionFee(EXAMPLE_PRICE).toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between text-xs font-medium text-[#5a7a55] border-t border-gray-200 pt-1 mt-1"><span>Total (+ envío)</span><span>${(EXAMPLE_PRICE + buyerProtectionFee(EXAMPLE_PRICE)).toLocaleString('es-CL')}</span></div>
              </div>
              <div className="bg-gray-50 p-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Vendedora recibe</p>
                <div className="flex justify-between text-xs mb-1"><span>Precio de venta</span><span>${EXAMPLE_PRICE.toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between text-xs mb-1"><span>Procesamiento ({Math.round(PROCESSING_FEE_PCT * 100)}% + ${PROCESSING_FEE_FIXED})</span><span>− ${paymentProcessingFee(EXAMPLE_PRICE).toLocaleString('es-CL')}</span></div>
                <div className="flex justify-between text-xs font-medium text-gray-800 border-t border-gray-200 pt-1 mt-1"><span>Recibe</span><span>${sellerPayout(EXAMPLE_PRICE).toLocaleString('es-CL')}</span></div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400">
              Todo se paga junto en un solo pago con Mercado Pago (tarjetas de crédito, débito y otros medios), y
              siempre mostramos el desglose completo antes de que confirmes tu compra.
            </p>
          </section>

          <section id="mensajes" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Mensajería</h2>
            <p className="mb-2">
              Puedes escribirle a la vendedora de una prenda para preguntarle algo antes de comprar — por ejemplo,
              una talla o un detalle que no se vea bien en las fotos. Cuando haces una oferta, se abre
              automáticamente una conversación con ella, donde queda visible el historial de la negociación además
              de los mensajes. La vendedora solo puede responderte a ti si tú le escribiste primero por esa prenda
              — no puede iniciar una conversación con cualquier persona.
            </p>
            <p className="mb-2">
              <strong>No está permitido usar el chat para compartir teléfonos, correos, direcciones, usuarios de
              redes sociales, ni para coordinar un pago o una venta fuera de Bdress Market.</strong> No hace falta
              hacerlo: la dirección de envío se entrega directamente en el checkout y el pago se procesa de forma
              segura por Mercado Pago, así que cualquier intento de cerrar la compra por fuera pierde la Protección
              BDress para ambas partes — sin garantía de reembolso ni de resolución de disputas.
            </p>
            <p>
              Para hacer cumplir esto, filtramos automáticamente los mensajes que parecen contener este tipo de
              información y bloqueamos su envío. Los intentos repetidos de saltarse la plataforma pueden resultar
              en la suspensión de la cuenta.
            </p>
          </section>

          <section id="disputas" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Devoluciones y disputas</h2>
            <p className="mb-2">
              Si hay un problema con tu compra o venta — por ejemplo, la prenda no llegó, no corresponde a la
              descripción, o no fue despachada a tiempo — puedes abrir una disputa desde el detalle de tu orden,
              mientras la orden esté pagada, despachada o recién confirmada.
            </p>
            <p className="mb-2">
              Una vez que la compra pasa a completada — 2 días después de que confirmas la recepción, o 7 días
              desde el despacho si nunca confirmas — ya no se puede abrir una disputa desde la app. Si te pasó
              algo después de ese plazo, escríbenos igual desde nuestra{' '}
              <Link href="/contacto" className="text-black underline underline-offset-2">página de contacto</Link>{' '}
              y lo revisamos caso a caso.
            </p>
            <p>
              Nuestro equipo revisa cada disputa de forma manual y resuelve reembolsando el pago completo a la
              compradora a través de Mercado Pago, o liberando el pago a la vendedora, según corresponda.
            </p>
          </section>

          <section id="cuentas" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Cuentas y conducta</h2>
            <p className="mb-2">
              Cada persona es responsable de la veracidad de la información de sus prendas publicadas: estado,
              talla, marca y fotos deben corresponder a la realidad.
            </p>
            <p>
              Nos reservamos el derecho de eliminar publicaciones que no cumplan con nuestras políticas, y de
              suspender cuentas ante conductas fraudulentas o incumplimientos reiterados.
            </p>
          </section>

          <section id="contacto" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Contacto</h2>
            <p>
              ¿Tienes dudas sobre estos términos o sobre una compra o venta puntual? Escríbenos desde nuestra{' '}
              <Link href="/contacto" className="text-black underline underline-offset-2">página de contacto</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
