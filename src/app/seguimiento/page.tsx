'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SeguimientoDashboard() {
  const supabase = createClient()
  const [ciclos, setCiclos] = useState<any[]>([])
  const [campanas, setCampanas] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)

      const { data: caps, error: e1 } = await supabase
        .from('campanas')
        .select('nombre')
        .order('nombre', { ascending: false })

      const { data: cs, error: e2 } = await supabase
        .from('vw_sa_resumen_ciclo')
        .select('*')

      if (e1) setError('Error campanas: ' + e1.message)
      if (e2) setError('Error vista: ' + e2.message)

      setCampanas(caps ?? [])
      setCiclos(cs ?? [])
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading) return <div className="p-10 text-campo-400">Cargando...</div>

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">Debug Dashboard</h1>
      {error && <div className="bg-red-100 text-red-700 p-4 rounded">{error}</div>}
      <div className="card p-4">
        <p><strong>Campañas encontradas:</strong> {campanas.length}</p>
        <p><strong>Ciclos encontrados:</strong> {ciclos.length}</p>
        {campanas.length > 0 && <p><strong>Primera campaña:</strong> {campanas[0].nombre}</p>}
        {ciclos.length > 0 && <p><strong>Primer ciclo:</strong> {JSON.stringify(ciclos[0])}</p>}
      </div>
    </div>
  )
}
