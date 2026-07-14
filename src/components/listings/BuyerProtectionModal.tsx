'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, ShieldCheck, RotateCcw, Lock, LifeBuoy } from 'lucide-react'

export default function BuyerProtectionModal({ iconSize = 13 }: { iconSize?: number }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  // Para los <Link> internos: solo evita que el click burbujee hasta la
  // tarjeta/link exterior — sin preventDefault, o Next.js cancela su propia
  // navegación (revisa e.defaultPrevented antes de hacer el push de ruta).
  function stopBubble(e: React.SyntheticEvent) {
    e.stopPropagation()
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { stop(e); setOpen(true) }}
        aria-label="Qué incluye la Protección BDress"
        className="inline-flex"
      >
        <ShieldCheck size={iconSize} className="text-[#8DA988] cursor-help" />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => { stop(e); setOpen(false) }}
        >
          <div
            className="relative w-full sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white p-6 sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false) }}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#8DA988]/10 flex items-center justify-center mb-4">
                <ShieldCheck size={26} className="text-[#5a7a55]" />
              </div>
              <h2 className="text-base font-medium">Protección al comprador</h2>
              <Link
                href="/terminos#pagos"
                onClick={stopBubble}
                className="text-xs text-[#5a7a55] underline underline-offset-2 mt-1"
              >
                Cómo calculamos la Protección BDress
              </Link>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Garantizamos tu protección en cada compra que haces en Bdress Market.
            </p>

            <div className="space-y-6 text-sm text-gray-600">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <RotateCcw size={16} className="text-[#5a7a55]" />
                  <h3 className="font-medium text-black">Política de reembolso</h3>
                </div>
                <p className="mb-2">Puedes recibir un reembolso completo si tu pedido:</p>
                <ul className="list-disc list-inside space-y-1 mb-3">
                  <li>nunca fue despachado</li>
                  <li>llega dañado</li>
                  <li>no corresponde a su descripción</li>
                </ul>
                <p>
                  Cuando confirmas la recepción, tienes <strong>2 días</strong> para reportar un problema antes de
                  que se libere el pago a la vendedora. Si no confirmas nada, asumimos que todo llegó bien y la
                  compra se marca como completada automáticamente a los <strong>7 días desde el despacho</strong>.
                  Conoce más en nuestra{' '}
                  <Link href="/terminos#disputas" onClick={stopBubble} className="text-[#5a7a55] underline underline-offset-2">
                    política de devoluciones
                  </Link>.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock size={16} className="text-[#5a7a55]" />
                  <h3 className="font-medium text-black">Transacciones seguras</h3>
                </div>
                <p>
                  Tu pago queda retenido de forma segura durante toda la transacción. No se le entrega a la
                  vendedora hasta 2 días después de que confirmas la recepción de tu pedido (o hasta 7 días desde
                  el despacho si nunca confirmas). Todo se procesa de forma cifrada por Mercado Pago — la
                  vendedora nunca ve tus datos de pago.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LifeBuoy size={16} className="text-[#5a7a55]" />
                  <h3 className="font-medium text-black">Asistencia dedicada</h3>
                </div>
                <p>
                  Escríbenos desde nuestra{' '}
                  <Link href="/contacto" onClick={stopBubble} className="text-[#5a7a55] underline underline-offset-2">
                    página de contacto
                  </Link>{' '}
                  ante cualquier problema con tu compra.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => { stop(e); setOpen(false) }}
              className="w-full bg-[#5a7a55] text-white text-sm tracking-widest uppercase py-3 mt-6 hover:bg-[#4a6647] transition"
            >
              Entendido
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
