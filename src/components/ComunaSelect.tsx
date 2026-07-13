import comunas from '@/lib/chilexpress-comunas.json'

const sortedComunas = [...comunas].sort((a, b) => a.name.localeCompare(b.name, 'es'))

interface ComunaSelectProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

export default function ComunaSelect({ value, onChange, required, className }: ComunaSelectProps) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} required={required} className={className}>
      <option value="">Selecciona tu comuna</option>
      {sortedComunas.map(c => (
        <option key={c.code} value={c.name}>{c.name}</option>
      ))}
    </select>
  )
}
