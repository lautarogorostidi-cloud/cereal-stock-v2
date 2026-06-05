'use client'
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Perfil } from '@/types'

const nav = [
  { href: '/dashboard',              label: 'Dashboard',       icon: '📊' },
  { href: '/dashboard/stock',        label: 'Stock',           icon: '🌾' },
  { href: '/dashboard/contratos',    label: 'Contratos',       icon: '📋' },
  { href: '/dashboard/ventas',       label: 'Ventas',          icon: '💰' },
  { href: '/dashboard/entregas',     label: 'Entregas',        icon: '🚛' },
  { href: '/dashboard/cartas-porte', label: 'Cartas de Porte', icon: '📄' },
  { href: '/dashboard/reportes',     label: 'Reportes',        icon: '📈' },
]

const navInsumos = [
  { href: '/dashboard/agroquimicos', label: 'Agroquímicos', icon: '🧪' },
  // Próximamente:
  // { href: '/dashboard/semillas',      label: 'Semillas',      icon: '🌱' },
  // { href: '/dashboard/fertilizantes', label: 'Fertilizantes', icon: '🧱' },
  // { href: '/dashboard/combustible',   label: 'Combustible',   icon: '⛽' },
]

const navAdmin = [
  { href: '/dashboard/admin/usuarios', label: 'Usuarios',       icon: '👥' },
  { href: '/dashboard/admin/maestros', label: 'Datos maestros', icon: '⚙️' },
]

interface SidebarProps { perfil: Perfil | null }

export default function Sidebar({ perfil }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navLink = (item: { href: string; label: string; icon: string }) => {
    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-campo-700 text-white font-medium'
            : 'text-campo-300 hover:bg-campo-800 hover:text-white'
        }`}
      >
        <span className="text-base">{item.icon}</span>
        {item.label}
      </Link>
    )
  }

  return (
    <aside className="w-60 flex flex-col bg-campo-950 text-campo-100 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-campo-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-campo-600 flex items-center justify-center text-base">🌾</div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Campo</div>
            <div className="text-campo-400 text-xs leading-tight">Stock Cereal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* Sección Cereal */}
        <div className="pb-1 px-3">
          <span className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Cereal</span>
        </div>
        {nav.map(navLink)}

        {/* Sección Insumos */}
        <div className="pt-4 pb-1 px-3">
          <span className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Insumos</span>
        </div>
        {navInsumos.map(navLink)}

        {/* Sección Admin */}
        {perfil?.rol === 'admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <span className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Administración</span>
            </div>
            {navAdmin.map(navLink)}
          </>
        )}
      </nav>

      {/* Perfil y logout */}
      <div className="px-3 py-4 border-t border-campo-800">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-campo-600 flex items-center justify-center text-xs font-bold text-white">
            {perfil?.nombre?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{perfil?.nombre} {perfil?.apellido}</div>
            <div className="text-xs text-campo-400 capitalize">{perfil?.rol}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-campo-400 hover:text-white hover:bg-campo-800 transition-colors"
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
