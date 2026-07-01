'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Perfil } from '@/types'

const nav = [
  { href: '/ganaderia',          label: 'Movimientos',       icon: '🐄' },
  { href: '/ganaderia/pastoreo', label: 'Pastoreo por lote', icon: '🌿' },
  { href: '/ganaderia/sanidad',  label: 'Sanidad',           icon: '💉' },
  { href: '/ganaderia/inmag',    label: 'INMAG',             icon: '📊' },
  { href: '/ganaderia/feedlot',  label: 'Feedlot',           icon: '🐮' },
]

interface GanaderiaSidebarProps { perfil: Perfil | null }

export default function GanaderiaSidebar({ perfil }: GanaderiaSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="w-60 flex flex-col bg-campo-950 text-campo-100 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-campo-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-campo-600 flex items-center justify-center text-base">🐄</div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Campo</div>
            <div className="text-campo-400 text-xs leading-tight">Ganadería</div>
          </div>
        </div>
      </div>

      {/* Volver al inicio */}
      <div className="px-3 pt-3">
        <Link
          href="/selector"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-campo-400 hover:text-white hover:bg-campo-800 transition-colors"
        >
          <span>←</span> Volver al inicio
        </Link>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const active =
            item.href === '/ganaderia'
              ? pathname === '/ganaderia'
              : pathname.startsWith(item.href)
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
        })}
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
