import { createHmac } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const FLOW_API_URL = process.env.FLOW_API_URL!
const FLOW_API_KEY = process.env.FLOW_API_KEY!
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY!

function flowSign(params: Record<string, string | number>): string {
  const toSign = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('')
  return createHmac('sha256', FLOW_SECRET_KEY).update(toSign).digest('hex')
}

// Service role client bypasses RLS — necesario porque Flow llama sin cookies de usuario
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return Response.json({ error: 'Token requerido' }, { status: 400 })
  }

  // Consultar estado del pago a Flow
  const statusParams: Record<string, string> = {
    apiKey: FLOW_API_KEY,
    token,
  }
  const signature = flowSign(statusParams)
  const qs = new URLSearchParams({ ...statusParams, s: signature })

  const flowRes = await fetch(`${FLOW_API_URL}/payment/getStatus?${qs}`)
  if (!flowRes.ok) {
    return Response.json({ error: 'Error consultando Flow' }, { status: 502 })
  }

  const payment = await flowRes.json()

  // Flow status: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
  if (payment.status === 2) {
    const supabase = getServiceClient()
    await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', payment.commerceOrder)
      .eq('status', 'pending_payment')
  }

  return Response.json({ status: 'ok' })
}

// Flow también puede llamar el webhook como POST
export async function POST(request: Request) {
  return GET(request)
}
