import Link from 'next/link'

const SECTIONS = [
  { id: 'que-es', label: 'Qué es Bdress Market' },
  { id: 'comprar', label: 'Cómo comprar' },
  { id: 'vender', label: 'Cómo vender' },
  { id: 'envios', label: 'Envíos' },
  { id: 'pagos', label: 'Pagos y comisión' },
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
        <p className="text-xs text-gray-400 mb-8">Última actualización: 13 de julio de 2026</p>

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
              <li>Explorá las prendas disponibles y filtrá por categoría, talla, estado o precio, y ordená los resultados de más recientes a más antiguas o por precio.</li>
              <li>Al entrar a una prenda que te interese, hacé clic en «Comprar» e ingresá tu dirección de despacho (comuna, calle, número y depto/casa si corresponde).</li>
              <li>Antes de pagar vas a ver el precio de la prenda, la Protección BDress y el costo real de envío — se cotiza al momento según tu comuna y la de la vendedora — con el total bien claro.</li>
              <li>El pago se realiza a través de Mercado Pago (tarjetas de crédito, débito y otros medios habilitados).</li>
              <li>Una vez confirmado el pago, la vendedora recibe aviso para despachar tu prenda dentro de los próximos días.</li>
              <li>Podés seguir el estado de tu compra en «Mis compras»: pagada → etiqueta generada → despachada → completada.</li>
              <li>Cuando confirmás la recepción (o pasan 7 días desde el despacho sin novedad), la compra se marca como completada y podés dejarle una reseña a la vendedora.</li>
            </ol>
          </section>

          <section id="vender" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Cómo vender</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Creá tu cuenta y completá tu perfil, incluyendo tu dirección de despacho (nombre, teléfono, dirección y comuna) — la vas a necesitar para generar etiquetas de envío.</li>
              <li>Publicá tu prenda con fotos, título, descripción, categoría y subcategoría, talla, marca, estado (nuevo con etiquetas, nuevo sin etiquetas, muy bueno, bueno o satisfactorio), tamaño de envío y precio. Publicar es gratis y no te cobramos comisión por vender.</li>
              <li>Cuando alguien compra tu prenda, te avisamos por correo. Entrá a «Mis ventas» y generá la etiqueta de envío: se genera automáticamente con Chilexpress y te llega lista para imprimir a tu correo.</li>
              <li>Imprimí la etiqueta, pegala en el paquete y llevalo a cualquier sucursal de Chilexpress.</li>
              <li>Una vez que la compradora confirma la recepción (o pasan 7 días desde el despacho sin disputa), el pago se libera a tu favor.</li>
            </ol>
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

            <p className="font-medium text-gray-800 mb-1">Si vendés</p>
            <p className="mb-4">
              Publicar es gratis y no te cobramos comisión por vender. Cuando se concreta una venta, solo se
              descuenta de tu pago el <strong>costo de procesamiento de la transacción</strong> (3,5% + $450), que
              es lo que cobra la pasarela de pago por procesar la compra — no es un cobro de Bdress.
            </p>

            <p className="font-medium text-gray-800 mb-1">Si comprás</p>
            <p className="mb-4">
              Pagás el precio que fijó la vendedora más un <strong>10% de Protección BDress</strong>, ya con todo
              incluido. Esta tarifa te permite pagar de forma segura, incluye seguimiento de tu envío y soporte de
              nuestro equipo si algo sale mal — y siempre la vas a ver reflejada en el precio final antes de pagar,
              nunca como un cargo sorpresa en el último paso.
            </p>

            <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Ejemplo con una prenda de $100.000</p>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="bg-gray-50 p-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Compradora paga</p>
                <div className="flex justify-between text-xs mb-1"><span>Precio del vestido</span><span>$100.000</span></div>
                <div className="flex justify-between text-xs mb-1"><span>Protección BDress (10%)</span><span>$10.000</span></div>
                <div className="flex justify-between text-xs font-medium text-[#5a7a55] border-t border-gray-200 pt-1 mt-1"><span>Total (+ envío)</span><span>$110.000</span></div>
              </div>
              <div className="bg-gray-50 p-3">
                <p className="text-[10px] tracking-widest uppercase text-gray-400 mb-2">Vendedora recibe</p>
                <div className="flex justify-between text-xs mb-1"><span>Precio de venta</span><span>$100.000</span></div>
                <div className="flex justify-between text-xs mb-1"><span>Procesamiento (3,5% + $450)</span><span>− $3.950</span></div>
                <div className="flex justify-between text-xs font-medium text-gray-800 border-t border-gray-200 pt-1 mt-1"><span>Recibe</span><span>$96.050</span></div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400">
              Todo se paga junto en un solo pago con Mercado Pago (tarjetas de crédito, débito y otros medios), y
              siempre mostramos el desglose completo antes de que confirmes tu compra.
            </p>
          </section>

          <section id="disputas" className="bg-white p-6 scroll-mt-4">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Devoluciones y disputas</h2>
            <p className="mb-2">
              Si hay un problema con tu compra o venta — por ejemplo, la prenda no llegó, no corresponde a la
              descripción, o no fue despachada a tiempo — podés abrir una disputa desde el detalle de tu orden.
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
              ¿Tenés dudas sobre estos términos o sobre una compra o venta puntual? Escribinos desde nuestra{' '}
              <Link href="/contacto" className="text-black underline underline-offset-2">página de contacto</Link>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
