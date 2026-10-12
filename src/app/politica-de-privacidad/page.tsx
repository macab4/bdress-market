import Link from 'next/link'

export default function PoliticaDePrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#EBEBEB]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-xs tracking-[6px] uppercase text-[#7fab87] mb-3">Bdress Market</p>
        <h1 className="text-2xl font-light tracking-widest uppercase mb-2">Política de privacidad</h1>
        <p className="text-xs text-gray-400 mb-8">Última actualización: 12 de octubre de 2026</p>

        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Qué datos recopilamos</h2>
            <p className="mb-2">Recopilamos los datos que nos entregas directamente al usar Bdress Market:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Al registrarte: nombre visible, nombre y apellido (para envíos), correo, teléfono, ciudad y comuna.</li>
              <li>Al comprar o vender: dirección de despacho, fotos y videos que subes a tus publicaciones o al chat, y el historial de tus compras, ventas, ofertas y mensajes.</li>
              <li>Al pagar: tu pago se procesa directamente por Mercado Pago — nosotros nunca vemos ni guardamos el número completo de tu tarjeta.</li>
              <li>Automáticamente: datos técnicos básicos de uso del sitio (como qué páginas visitas) para entender cómo mejorar la plataforma.</li>
            </ul>
          </section>

          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Para qué los usamos</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Operar la plataforma: mostrar tus publicaciones, procesar compras y ventas, generar etiquetas de envío.</li>
              <li>Comunicarnos contigo: confirmaciones de compra/venta, recordatorios, respuestas a tus consultas.</li>
              <li>Prevenir fraude y hacer cumplir nuestros Términos y Condiciones.</li>
              <li>Mejorar la plataforma a partir de cómo se usa.</li>
            </ul>
          </section>

          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Con quién los compartimos</h2>
            <p className="mb-2">
              No vendemos tus datos personales a terceros. Los compartimos únicamente con quienes necesitamos para
              operar el servicio:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>La otra parte de una transacción ve lo necesario para completarla (nombre, dirección de despacho y teléfono de contacto), nunca más que eso.</li>
              <li>Mercado Pago, para procesar tu pago de forma segura.</li>
              <li>La empresa de transporte (Starken), para la generación y seguimiento de etiquetas de envío.</li>
              <li>Proveedores que nos ayudan a operar la plataforma (hosting, envío de correos), bajo las mismas condiciones de confidencialidad.</li>
            </ul>
          </section>

          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Tus derechos</h2>
            <p>
              De acuerdo con la Ley N° 19.628 sobre Protección de la Vida Privada, puedes pedirnos acceder, corregir
              o eliminar tus datos personales, o retirar tu consentimiento para su uso. Para esto, o si tienes
              cualquier duda sobre esta política, escríbenos desde nuestra{' '}
              <Link href="/contacto" className="text-black underline underline-offset-2">página de contacto</Link>.
              Si cierras tu cuenta, eliminamos o anonimizamos tus datos salvo los que debamos conservar por
              obligación legal o para resolver disputas en curso.
            </p>
          </section>

          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Seguridad</h2>
            <p>
              Protegemos tus datos con medidas técnicas razonables (acceso restringido, conexiones cifradas). Ningún
              sistema es 100% infalible, pero nos tomamos en serio cualquier incidente que pueda afectar tu
              información.
            </p>
          </section>

          <section className="bg-white p-6">
            <h2 className="text-sm font-medium text-black tracking-widest uppercase mb-3">Cambios a esta política</h2>
            <p>
              Si hacemos cambios significativos a esta política, te avisamos por correo o con un aviso en el sitio
              antes de que entren en vigencia.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
