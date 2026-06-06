'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Lote = {
  id: string
  nombre: string
  establecimiento: string
  hectareas: number
  activo: boolean
}

type Ciclo = {
  ciclo_id: number
  lote: string
  campo: string
  cultivo: string
  campana: string
  sup_sembrada: number
  rinde_kg_ha: number | null
  fecha_siembra: string | null
  fecha_cosecha: string | null
}

export default function LotesPage() {
  const supabase = createClient()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [campanas, setCampanas] = useState<string[]>([])
  const [campanaSeleccionada, setCampanaSeleccionada] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [{ data: ls }, { data: cs }, { data: caps }] = await Promise.all([
        supabase.from('lotes').select('*').eq('activo', true).order('establecimiento').order('nombre'),
        supabase.from('vw_sa_resumen_ciclo').select('*'),
        supabase.from('campanas').select('nombre').order('nombre', { ascending: false }),
      ])
      setLotes(ls ?? [])
      setCiclos(cs ?? [])
      const nombres = (caps ?? []).map((c: any) => c.nombre)
      setCampanas(nombres)
      if (nombres.length > 0) setCampanaSeleccionada(nombres[0])
      setLoading(false)
    }
    cargar()
  }, [])

  const campos = [...new Set(lotes.map(l => l.establecimiento))].sort()

  const lotesFiltrados = lotes.filter(l =>
    !filtroCampo || l.establecimiento === filtroCampo
  )

  const getCiclo = (loteNombre: string) =>
    ciclos.find(c => c.lote === loteNombre && c.campana === campanaSeleccionada)

  const fmt = (n: number | null | undefined) =>
    n != null ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 }) : '—'

  // Agrupar por campo
  const lotesPorCampo = lotesFiltrados.reduce((acc: Record<string, Lote[]>, l) => {
    if (!acc[l.establecimiento]) acc[l.establecimiento] = []
    acc[l.establecimiento].push(l)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Lotes</h1>
          <p className="text-campo-500 text-sm mt-0.5">{lotes.length} lotes en {campos.length} establecimientos</p>
        </div>
        <Link
          href="/seguimiento/lotes/nuevo"
          className="bg-lime-700 hover:bg-lime-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo ciclo
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div>
          <label className="text-xs font-medium text-campo-600 mr-2">Campaña</label>
          <select
            value={campanaSeleccionada}
            onChange={e => setCampanaSeleccionada(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            {campanas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-campo-600 mr-2">Campo</label>
          <select
            value={filtroCampo}
            onChange={e => setFiltroCampo(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="">Todos</option>
            {campos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-center text-campo-400 py-10">Cargando...</div>}

      {/* Tablas por campo */}
      {!loading && Object.entries(lotesPorCampo).map(([campo, ls]) => (
        <div key={campo} className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">🏡 {campo} — {ls.length} lotes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Sup. sembrada</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Siembra</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Cosecha</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ls.map(l => {
                  const ciclo = getCiclo(l.nombre)
                  return (
                    <tr key={l.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-campo-900">{l.nombre}</td>
                      <td className="px-5 py-3 text-right text-campo-600">{fmt(l.hectareas)}</td>
                      <td className="px-5 py-3">
                        {ciclo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">
                            {ciclo.cultivo}
                          </span>
                        ) : (
                          <span className="text-campo-400 text-xs">Sin ciclo</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-campo-600">
                        {ciclo ? fmt(ciclo.sup_sembrada) : '—'}
                      </td>
                      <td className="px-5 py-3 text-campo-600">
                        {ciclo?.fecha_siembra
                          ? new Date(ciclo.fecha_siembra + 'T00:00:00').toLocaleDateString('es-AR')
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-campo-600">
                        {ciclo?.fecha_cosecha
                          ? new Date(ciclo.fecha_cosecha + 'T00:00:00').toLocaleDateString('es-AR')
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-campo-900">
                        {fmt(ciclo?.rinde_kg_ha)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {ciclo ? (
                          <Link
                            href={`/seguimiento/lotes/${ciclo.ciclo_id}`}
                            className="text-xs text-lime-700 hover:text-lime-600 font-medium"
                          >
                            Ver ficha →
                          </Link>
                        ) : (
                          <Link
                            href={`/seguimiento/lotes/nuevo?lote=${l.id}`}
                            className="text-xs text-campo-400 hover:text-lime-700 font-medium"
                          >
                            + Agregar
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
