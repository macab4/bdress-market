'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, ShieldAlert, Lock, Link2Off, Megaphone } from 'lucide-react'

const STORAGE_KEY = 'bdress-security-tips-seen'

function FraudExample({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded p-3 text-left text-sm text-gray-700 italic">
      {children}
    </div>
  )
}

const STEPS: { Icon: typeof ShieldAlert; title: string; body: React.ReactNode }[] = [
  {
    Icon: ShieldAlert,
    title: 'Antes de escribir, protégete',
    body: (
      <p>
        Algunas personas intentan aprovecharse de compradoras y vendedoras nuevas en marketplaces como este.
        Te mostramos sus trucos más comunes para que los reconozcas a tiempo.
      </p>
    ),
  },
  {
    Icon: Lock,
    title: 'No compartas tus datos fuera de Bdress',
    body: (
      <div className="space-y-3">
        <FraudExample>
          "Hola! Me interesa tu vestido 😍 ¿me pasas tu whatsapp para coordinar directo y nos ahorramos la comisión?"
        </FraudExample>
        <p>
          En Bdress Market no hay comisión que ahorrarse, y la dirección de envío y el pago ya quedan resueltos
          dentro de la plataforma. Cualquier mensaje que te pida tu teléfono, correo o pagar por fuera pierde la
          Protección BDress y suele ser un intento de estafa.
        </p>
      </div>
    ),
  },
  {
    Icon: Link2Off,
    title: 'Cuidado con enlaces y correos falsos',
    body: (
      <div className="space-y-3">
        <FraudExample>
          "¡Tu etiqueta de envío está lista! Verifica tu tarjeta aquí: bdressmarket-pagos.info"
        </FraudExample>
        <p>
          Los correos reales de Bdress Market siempre llegan desde <strong>@bdressmarket.cl</strong> y sus links
          apuntan a <strong>bdressmarket.cl</strong>. Nunca te vamos a pedir el número de tu tarjeta por correo,
          mensaje ni WhatsApp.
        </p>
      </div>
    ),
  },
  {
    Icon: Megaphone,
    title: '¿Viste algo raro? Avísanos',
    body: (
      <p>
        Si recibes un mensaje o correo sospechoso, no respondas ni hagas clic en nada. Escríbenos desde nuestra{' '}
        <Link href="/contacto" className="text-[#5a7a55] underline underline-offset-2">página de contacto</Link>{' '}
        y lo revisamos. Ya bloqueamos automáticamente los mensajes que intentan compartir datos de contacto o pago
        fuera de la plataforma, pero tu ayuda para detectar casos nuevos es súper valiosa.
      </p>
    ),
  },
]

interface SecurityTipsModalProps {
  autoShow?: boolean
  trigger?: React.ReactNode
  triggerClassName?: string
}

export default function SecurityTipsModal({ autoShow, trigger, triggerClassName }: SecurityTipsModalProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!autoShow) return
    if (window.localStorage.getItem(STORAGE_KEY)) return
    setOpen(true)
  }, [autoShow])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function stop(e: React.SyntheticEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function close() {
    setOpen(false)
    setStep(0)
    window.localStorage.setItem(STORAGE_KEY, '1')
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <>
      {trigger && (
        <button
          type="button"
          onClick={(e) => { stop(e); setStep(0); setOpen(true) }}
          className={triggerClassName ?? 'inline-flex'}
        >
          {trigger}
        </button>
      )}

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={(e) => { stop(e); close() }}
        >
          <div
            className="relative w-full sm:max-w-sm max-h-[90vh] overflow-y-auto bg-white p-6 sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { stop(e); close() }}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-gray-400 hover:text-black"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-[#7fab87]/10 flex items-center justify-center mb-4">
                <current.Icon size={26} className="text-[#5a7a55]" />
              </div>
              <h2 className="text-base font-medium">{current.title}</h2>
            </div>

            <div className="text-sm text-gray-600 leading-relaxed">
              {current.body}
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-6 mb-3">
              {STEPS.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-[#7fab87]' : 'bg-gray-200'}`} />
              ))}
            </div>

            <button
              type="button"
              onClick={(e) => { stop(e); isLast ? close() : setStep(s => s + 1) }}
              className="w-full bg-[#7fab87] text-white text-sm tracking-widest uppercase py-3 hover:bg-[#6f9678] transition"
            >
              {isLast ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
