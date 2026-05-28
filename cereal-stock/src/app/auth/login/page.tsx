'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    // Forzar recarga completa para que el servidor reconozca la sesión
    window.location.href = '/dashboard'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-campo-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-grain opacity-30" />
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #445722 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, #86411c 0%, transparent 50%)'
        }}
      />

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-campo-600 mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 3c-4.97 0-9 3.185-9 7.115 0 3.928 4.03 7.115 9 7.115s9-3.187 9-7.115C21 6.185 16.97 3 12 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 10c0 3.93 4.03 7.115 9 7.115S21 13.93 21 10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Campo</h1>
          <p className="text-campo-300 text-sm mt-1">Sistema Agropecuario · Stock de Cereal</p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-campo-100 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@campo.com"
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40
                           focus:outline-none focus:ring-2 focus:ring-campo-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-100 mb-1.5">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-white/40
                           focus:outline-none focus:ring-2 focus:ring-campo-400 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-campo-500 hover:bg-campo-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-campo-500 text-xs mt-6">
          © {new Date().getFullYear()} Sistema Agropecuario
        </p>
      </div>
    </div>
  )
}
