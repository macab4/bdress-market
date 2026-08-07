import {
  INTERNATIONAL_STATUS_CONFIG, INTERNATIONAL_STATUS_FLOW, INTERNATIONAL_CANCELLATION_FLOW, isPastEstimatedDelivery,
} from '@/lib/international/status'
import { internationalDelayMessage, leadTimeRange } from '@/lib/international/content'
import { InternationalStatus, OrderStatusHistoryEntry } from '@/types'

interface Props {
  currentStatus: InternationalStatus
  history: OrderStatusHistoryEntry[]
  paidAt: string | null
  leadTimeMinDays: number | null
  leadTimeMaxDays: number | null
}

const CANCELLATION_STATUSES = new Set(INTERNATIONAL_CANCELLATION_FLOW)

export default function InternationalOrderTimeline({ currentStatus, history, paidAt, leadTimeMinDays, leadTimeMaxDays }: Props) {
  const isCancellation = CANCELLATION_STATUSES.has(currentStatus)
  const flow = isCancellation ? INTERNATIONAL_CANCELLATION_FLOW : INTERNATIONAL_STATUS_FLOW
  const currentIndex = flow.indexOf(currentStatus)
  const { min, max } = leadTimeRange(leadTimeMinDays, leadTimeMaxDays)
  const late = isPastEstimatedDelivery(paidAt, leadTimeMaxDays, currentStatus)
  const lastUpdate = history[history.length - 1]
  const notesByStatus = new Map(history.filter(h => h.public_note).map(h => [h.new_status, h.public_note]))

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] text-gray-400">
        Entrega estimada: {min}–{max} días corridos desde la confirmación de disponibilidad
        {lastUpdate && ` · Última actualización: ${new Date(lastUpdate.created_at).toLocaleDateString('es-CL')}`}
      </p>

      <ol className="space-y-1.5">
        {flow.map((status, i) => {
          const done = i <= currentIndex
          const config = INTERNATIONAL_STATUS_CONFIG[status]
          const note = notesByStatus.get(status)
          return (
            <li key={status} className={`flex items-start gap-2 text-xs ${done ? 'text-gray-700' : 'text-gray-300'}`}>
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${done ? 'bg-[#7fab87]' : 'bg-gray-200'}`} />
              <span>
                {config.label}
                {done && note && <span className="block text-[10px] text-gray-400">{note}</span>}
              </span>
            </li>
          )
        })}
      </ol>

      {late && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 mt-2">{internationalDelayMessage()}</p>
      )}
    </div>
  )
}
