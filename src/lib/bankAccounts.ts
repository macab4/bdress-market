import type { BankAccountType } from '@/types'

export const CHILEAN_BANKS = [
  'Banco de Chile', 'Banco Estado', 'Banco Santander', 'Banco BCI',
  'Banco Itaú', 'Scotiabank', 'Banco Falabella', 'Banco Ripley',
  'Banco Security', 'Banco Consorcio', 'Banco BICE', 'HSBC Bank Chile',
  'Banco Internacional', 'Coopeuch', 'Tenpo', 'Mercado Pago', 'Otro',
] as const

export const ACCOUNT_TYPES: { value: BankAccountType; label: string }[] = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Cuenta de ahorro' },
  { value: 'vista', label: 'Cuenta vista' },
  { value: 'rut', label: 'Cuenta RUT' },
]

export function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type
}

// Enmascara el número de cuenta para toda vista salvo el detalle de retiro
// en /admin/wallet/withdrawals/[id] (la admin necesita el número completo
// para poder hacer la transferencia manual).
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\s+/g, '')
  const last4 = digits.slice(-4)
  return `••••${last4}`
}
