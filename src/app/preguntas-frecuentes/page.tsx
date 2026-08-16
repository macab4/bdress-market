import Link from 'next/link'
import {
  COMMISSION_PCT, PROCESSING_FEE_PCT, PROCESSING_FEE_FIXED,
  SHIP_DEADLINE_BUSINESS_DAYS, CONFIRMED_HOLD_DAYS, SHIPPED_FALLBACK_DAYS, MIN_WITHDRAWAL_AMOUNT,
} from '@/lib/catalog'
import { INTERNATIONAL_MODE_NAME } from '@/lib/international/content'

const FAQS: { question: string; answer: React.ReactNode }[] = [
  {
    question: '¿Qué es Bdress Market?',
    answer: (
      <p>
        Una plataforma donde personas de la comunidad Bdress compran y venden prendas de segunda mano entre
        ellas. Facilitamos el pago, el cálculo del envío y la resolución de problemas — cada prenda pertenece y
        es publicada directamente por la persona que la vende.
      </p>
    ),
  },
  {
    question: '¿Cuánto cuesta vender?',
    answer: (
      <p>
        Publicar es <strong>gratis</strong> y no te cobramos comisión por vender. Cuando se concreta una venta,
        solo se descuenta el costo de procesamiento del pago ({Math.round(PROCESSING_FEE_PCT * 100)}% + $
        {PROCESSING_FEE_FIXED}) — eso lo cobra la pasarela de pago, no Bdress.
      </p>
    ),
  },
  {
    question: '¿Qué es la Protección BDress?',
    answer: (
      <p>
        Un {Math.round(COMMISSION_PCT * 100)}% que paga la compradora, incluido en el precio final antes de
        pagar. Cubre pagos seguros, seguimiento del envío y soporte de nuestro equipo si algo sale mal — incluido
        el reembolso completo si corresponde. Más detalle en{' '}
        <Link href="/terminos#pagos" className="text-[#5a7a55] underline underline-offset-2">Pagos y comisión</Link>.
      </p>
    ),
  },
  {
    question: '¿Cuánto tiene la vendedora para despachar?',
    answer: (
      <p>
        <strong>{SHIP_DEADLINE_BUSINESS_DAYS} días hábiles</strong> desde que se confirma el pago. Si no despacha
        a tiempo, la compradora puede solicitar el reembolso completo.
      </p>
    ),
  },
  {
    question: '¿Cuándo se libera el pago a la vendedora?',
    answer: (
      <p>
        Cuando la compradora confirma la recepción, esperamos <strong>{CONFIRMED_HOLD_DAYS} días</strong> por si
        reporta un problema — si no lo hace, el pago se libera. Si nunca confirma, el pago se libera igual de
        forma automática a los <strong>{SHIPPED_FALLBACK_DAYS} días</strong> desde el despacho, para que ninguna
        venta quede pagando eternamente.
      </p>
    ),
  },
  {
    question: '¿Qué pasa si tengo un problema con mi compra?',
    answer: (
      <p>
        Puedes reportarlo desde el detalle de tu orden mientras esté pagada, despachada o recién confirmada.
        Nuestro equipo revisa cada caso y resuelve liberando el pago a la vendedora, reembolsándote directo, o
        aprobando una devolución — según corresponda. Detalle completo en{' '}
        <Link href="/terminos#disputas" className="text-[#5a7a55] underline underline-offset-2">Devoluciones y disputas</Link>.
      </p>
    ),
  },
  {
    question: '¿Cómo funciona una devolución?',
    answer: (
      <p>
        Si ya recibiste la prenda y no corresponde a lo publicado o llegó dañada, te enviamos una etiqueta para
        devolverla — sin costo para ti, Bdress lo cubre. El reembolso completo (incluida la Protección BDress) se
        procesa recién cuando la vendedora recibe la prenda de vuelta, para que nadie se quede sin la prenda ni
        sin la plata.
      </p>
    ),
  },
  {
    question: '¿Qué es el Saldo B-Dress?',
    answer: (
      <p>
        Es tu billetera dentro de Bdress: ahí se te acredita lo que ganas vendiendo. Puedes usarlo para pagar
        otra compra (parcial o totalmente) o transferirlo a tu cuenta bancaria desde{' '}
        <Link href="/dashboard/wallet" className="text-[#5a7a55] underline underline-offset-2">Mi saldo</Link>.
        El monto mínimo para retirar es ${MIN_WITHDRAWAL_AMOUNT.toLocaleString('es-CL')}.
      </p>
    ),
  },
  {
    question: `¿Qué es ${INTERNATIONAL_MODE_NAME}?`,
    answer: (
      <p>
        Algunos productos del catálogo se traen especialmente desde plataformas internacionales — se identifican
        con esa etiqueta en la ficha del producto. Tienen un plazo de entrega más largo que una compra nacional.
        Más detalle en{' '}
        <Link href="/terminos#internacional" className="text-[#5a7a55] underline underline-offset-2">{INTERNATIONAL_MODE_NAME}</Link>.
      </p>
    ),
  },
  {
    question: '¿Es seguro pagar en Bdress Market?',
    answer: (
      <p>
        Sí — el pago se procesa de forma cifrada por Mercado Pago, la vendedora nunca ve tus datos de pago, y tu
        dinero queda retenido de forma segura hasta que confirmas la recepción. Nunca coordines un pago por fuera
        de la plataforma: pierdes toda la Protección BDress. Más en{' '}
        <Link href="/terminos#seguridad" className="text-[#5a7a55] underline underline-offset-2">Seguridad y estafas</Link>.
      </p>
    ),
  },
  {
    question: '¿Qué hago si recibo un correo o mensaje sospechoso?',
    answer: (
      <p>
        No respondas ni hagas clic en nada. Los correos reales de Bdress siempre llegan desde{' '}
        <strong>@bdressmarket.cl</strong>. Escríbenos desde{' '}
        <Link href="/contacto" className="text-[#5a7a55] underline underline-offset-2">nuestra página de contacto</Link>{' '}
        si algo te generó dudas.
      </p>
    ),
  },
]

export default function PreguntasFrecuentesPage() {
  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-3">Bdress Market</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-2">Preguntas frecuentes</h1>
        <p className="text-xs text-gray-400 mb-8">
          ¿No encuentras lo que buscas? Revisa nuestros{' '}
          <Link href="/terminos" className="text-[#5a7a55] underline underline-offset-2">Términos y condiciones</Link>{' '}
          o{' '}
          <Link href="/contacto" className="text-[#5a7a55] underline underline-offset-2">escríbenos</Link>.
        </p>

        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <div key={i} className="bg-white p-6">
              <h2 className="text-sm font-medium text-black mb-2">{faq.question}</h2>
              <div className="text-sm text-gray-600 leading-relaxed">{faq.answer}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
