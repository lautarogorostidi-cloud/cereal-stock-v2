'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { MODULOS } from '@/config/modulos'
import type { Perfil } from '@/types'

export default function SelectorPage() {
  const router = useRouter()
  const supabase = createClient()
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    async function cargarPerfil() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
      setPerfil(data)
    }
    cargarPerfil()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-campo-950 relative overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0 bg-grain opacity-20" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 60%, #445722 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, #86411c 0%, transparent 45%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-campo-600 flex items-center justify-center text-lg">🌾</div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Campo</div>
            <div className="text-campo-400 text-xs leading-tight">Sistema Agropecuario</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {perfil && (
            <div className="text-right">
              <div className="text-sm text-white font-medium">{perfil.nombre} {perfil.apellido}</div>
              <div className="text-xs text-campo-400 capitalize">{perfil.rol}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-campo-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">
            Bienvenido{perfil ? `, ${perfil.nombre}` : ''}
          </h1>
          <p className="text-campo-300 text-base">Seleccioná el módulo al que querés acceder</p>
        </div>

        {/* Tarjetas generadas automáticamente desde config/modulos.ts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
          {MODULOS.map((mod) => (
            <button
              key={mod.titulo}
              onClick={() => mod.activo && router.push(mod.href)}
              disabled={!mod.activo}
              className={`relative text-left rounded-2xl border bg-white/5 backdrop-blur-sm p-6 transition-all duration-200 ${mod.color}`}
            >
              <span className={`absolute top-4 right-4 text-xs font-medium px-2 py-0.5 rounded-full ${mod.badgeColor}`}>
                {mod.activo ? 'Activo' : 'Próximamente'}
              </span>
              <div className="text-4xl mb-4">{mod.icon}</div>
              <div className="font-bold text-white text-lg mb-1">{mod.titulo}</div>
              <div className="text-campo-300 text-sm leading-relaxed">{mod.descripcion}</div>
            </button>
          ))}
        </div>

        <p className="text-campo-600 text-xs mt-12">© {new Date().getFullYear()} Sistema Agropecuario</p>
      </div>
    </div>
  )
}