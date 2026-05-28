import type { Perfil } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface TopBarProps { perfil: Perfil | null }

export default function TopBar({ perfil }: TopBarProps) {
  const hoy = format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })

  return (
    <header className="h-14 border-b border-campo-100 bg-white flex items-center justify-between px-6 shrink-0">
      <div className="text-sm text-campo-500 capitalize">{hoy}</div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-campo-600 font-medium">
          {perfil?.nombre} {perfil?.apellido}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
          ${perfil?.rol === 'admin' ? 'bg-campo-100 text-campo-700' :
            perfil?.rol === 'comercial' ? 'bg-tierra-100 text-tierra-700' :
            'bg-gray-100 text-gray-600'}`}>
          {perfil?.rol}
        </span>
      </div>
    </header>
  )
}
