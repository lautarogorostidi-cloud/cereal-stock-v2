interface KPICardProps {
  titulo: string
  valor: string
  descripcion: string
  color: 'verde' | 'trigo' | 'azul' | 'naranja'
  icono: string
}

const colores = {
  verde:   { bg: 'bg-campo-50',  border: 'border-campo-200',  text: 'text-campo-800',  sub: 'text-campo-500',  dot: 'bg-campo-500' },
  trigo:   { bg: 'bg-tierra-50', border: 'border-tierra-200', text: 'text-tierra-800', sub: 'text-tierra-500', dot: 'bg-tierra-500' },
  azul:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   sub: 'text-blue-500',   dot: 'bg-blue-500' },
  naranja: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800', sub: 'text-orange-500', dot: 'bg-orange-500' },
}

export default function KPICard({ titulo, valor, descripcion, color }: KPICardProps) {
  const c = colores[color]
  return (
    <div className={`rounded-2xl border ${c.bg} ${c.border} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${c.sub}`}>{titulo}</span>
      </div>
      <div className={`text-2xl font-bold ${c.text} mb-1`}>{valor}</div>
      <div className={`text-xs ${c.sub}`}>{descripcion}</div>
    </div>
  )
}
