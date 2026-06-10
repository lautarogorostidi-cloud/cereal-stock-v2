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
  sup_cosechada: number | null
  rinde_kg_ha: number | null
  fecha_siembra: string | null
  fecha_cosecha: string | null
}

type Aplicacion = {
  id: number
  ciclo_id: number
  tipo: string
  fecha: string | null
  superficie_ha: number
  productos: string[]
}

export default function LotesPage() {
  const supabase = createClient()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [campanas, setCampanas] = useState<string[]>([])
  const [campanaSeleccionada, setCampanaSeleccionada] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [vistaSeleccionada, setVistaSeleccionada] = useState<'lote' | 'cultivo'>('lote')
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [{ data: ls }, { data: cs }, { data: caps }, { data: apls }, { data: prods }] = await Promise.all([
        supabase.from('lotes').select('*').eq('activo', true).order('establecimiento').order('nombre'),
        supabase.from('vw_sa_resumen_ciclo').select('*'),
        supabase.from('campanas').select('nombre').order('nombre', { ascending: false }),
        supabase.from('sa_aplicaciones').select('id, ciclo_id, tipo, fecha, superficie_ha'),
        supabase.from('sa_aplicacion_productos').select('aplicacion_id, producto'),
      ])

      setLotes(ls ?? [])
      setCiclos(cs ?? [])

      const prodsMap: Record<number, string[]> = {}
      ;(prods ?? []).forEach((p: any) => {
        if (!prodsMap[p.aplicacion_id]) prodsMap[p.aplicacion_id] = []
        if (!prodsMap[p.aplicacion_id].includes(p.producto)) {
          prodsMap[p.aplicacion_id].push(p.producto)
        }
      })

      setAplicaciones((apls ?? []).map((a: any) => ({
        ...a,
        productos: prodsMap[a.id] ?? [],
      })))

      const nombres = (caps ?? []).map((c: any) => c.nombre)
      setCampanas(nombres)
      if (nombres.length > 0) setCampanaSeleccionada(nombres[0])
      setLoading(false)
    }
    cargar()
  }, [])

  const campos = Array.from(new Set(lotes.map(l => l.establecimiento))).sort()
  const ciclosCampana = ciclos.filter(c => c.campana === campanaSeleccionada)

  const getCiclos = (loteNombre: string) =>
    ciclosCampana.filter(c => c.lote === loteNombre)

  const getAplicaciones = (cicloId: number) =>
    aplicaciones.filter(a => a.ciclo_id === cicloId)

  const getHaPulverizadas = (cicloId: number) =>
    aplicaciones.filter(a => a.ciclo_id === cicloId).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)

  const toggleExpandido = (cicloId: number) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(cicloId)) next.delete(cicloId)
      else next.add(cicloId)
      return next
    })
  }

  type Fila = { lote: Lote; ciclo: Ciclo | null }

  const lotesFiltrados = lotes.filter(l => {
    if (filtroCampo && l.establecimiento !== filtroCampo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const matchLote = l.nombre.toLowerCase().includes(q)
      const matchCultivo = getCiclos(l.nombre).some(c => c.cultivo.toLowerCase().includes(q))
      return matchLote || matchCultivo
    }
    return true
  })

  const filas: Fila[] = []
  lotesFiltrados.forEach(l => {
    const cs = getCiclos(l.nombre)
    if (cs.length === 0) filas.push({ lote: l, ciclo: null })
    else cs.forEach(c => filas.push({ lote: l, ciclo: c }))
  })

  const fmt = (n: number | null | undefined) =>
    n != null ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 }) : '—'

  const fmtFecha = (s: string | null) =>
    s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

  // ─── Vista por Cultivo ────────────────────────────────────────────────────
  const porCultivo = ciclosCampana
    .filter(c => lotesFiltrados.some(l => l.nombre === c.lote))
    .reduce((acc: Record<string, { ciclos: Ciclo[]; haSembrada: number; haCosechada: number; haPulv: number; kg: number }>, c) => {
      if (!acc[c.cultivo]) acc[c.cultivo] = { ciclos: [], haSembrada: 0, haCosechada: 0, haPulv: 0, kg: 0 }
      acc[c.cultivo].ciclos.push(c)
      acc[c.cultivo].haSembrada += Number(c.sup_sembrada ?? 0)
      acc[c.cultivo].haCosechada += Number(c.sup_cosechada ?? 0)
      acc[c.cultivo].haPulv += getHaPulverizadas(c.ciclo_id)
      acc[c.cultivo].kg += Number(c.rinde_kg_ha && c.sup_cosechada ? c.rinde_kg_ha * c.sup_cosechada : 0)
      return acc
    }, {})

  const filasPorCampo = filas.reduce((acc: Record<string, Fila[]>, f) => {
    const campo = f.lote.establecimiento
    if (!acc[campo]) acc[campo] = []
    acc[campo].push(f)
    return acc
  }, {})

  const totalLotesConCiclo = new Set(filas.filter(f => f.ciclo).map(f => f.lote.nombre)).size

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Lotes y Cultivos</h1>
          <p className="text-campo-500 text-sm mt-0.5">
            {totalLotesConCiclo} de {lotesFiltrados.length} lotes con ciclo en {campanaSeleccionada}
          </p>
        </div>
        {/* Selector Vista */}
        <div className="flex rounded-lg border border-campo-200 overflow-hidden text-sm">
          <button
            onClick={() => setVistaSeleccionada('lote')}
            className={`px-4 py-2 font-medium transition-colors ${vistaSeleccionada === 'lote' ? 'bg-lime-600 text-white' : 'text-campo-600 hover:bg-campo-50'}`}
          >
            Por Lote
          </button>
          <button
            onClick={() => setVistaSeleccionada('cultivo')}
            className={`px-4 py-2 font-medium transition-colors ${vistaSeleccionada === 'cultivo' ? 'bg-lime-600 text-white' : 'text-campo-600 hover:bg-campo-50'}`}
          >
            Por Cultivo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar lote o cultivo..."
          className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 w-56"
        />
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
        {busqueda && (
          <button
            onClick={() => setBusqueda('')}
            className="text-xs text-campo-400 hover:text-campo-700 px-2 py-1.5 rounded-lg hover:bg-campo-100 transition-colors"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading && <div className="text-center text-campo-400 py-10">Cargando...</div>}

      {/* ─── VISTA POR LOTE ─────────────────────────────────────────────── */}
      {!loading && vistaSeleccionada === 'lote' && (
        <>
          {Object.keys(filasPorCampo).length === 0 && (
            <div className="card p-10 text-center text-campo-400">No se encontraron lotes</div>
          )}
          {Object.entries(filasPorCampo).map(([campo, fs]) => (
            <div key={campo} className="card overflow-hidden p-0">
              <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
                <h2 className="font-semibold text-campo-700 text-sm">
                  🏡 {campo} — {new Set(fs.map(f => f.lote.nombre)).size} lotes
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-campo-100">
                      <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                      <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha lote</th>
                      <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                      <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                      <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                      <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha pulverizadas</th>
                      <th className="text-left px-5 py-3 font-semibold text-campo-700">Siembra</th>
                      <th className="text-left px-5 py-3 font-semibold text-campo-700">Cosecha</th>
                      <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                      <th className="text-center px-5 py-3 font-semibold text-campo-700">Pulverizaciones</th>
                      <th className="text-center px-5 py-3 font-semibold text-campo-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fs.map((f) => {
                      const apls = f.ciclo ? getAplicaciones(f.ciclo.ciclo_id) : []
                      const haPulv = f.ciclo ? getHaPulverizadas(f.ciclo.ciclo_id) : 0
                      const expandido = f.ciclo ? expandidos.has(f.ciclo.ciclo_id) : false
                      return (
                        <>
                          <tr key={`${f.lote.id}-${f.ciclo?.ciclo_id ?? 'sin'}`} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                            <td className="px-5 py-3 font-medium text-campo-900">{f.lote.nombre}</td>
                            <td className="px-5 py-3 text-right text-campo-600">{fmt(f.lote.hectareas)}</td>
                            <td className="px-5 py-3">
                              {f.ciclo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">
                                  {f.ciclo.cultivo}
                                </span>
                              ) : (
                                <span className="text-campo-400 text-xs">Sin ciclo</span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right text-campo-600">{f.ciclo ? fmt(f.ciclo.sup_sembrada) : '—'}</td>
                            <td className="px-5 py-3 text-right text-campo-600">{f.ciclo?.sup_cosechada ? fmt(f.ciclo.sup_cosechada) : '—'}</td>
                            <td className="px-5 py-3 text-right text-campo-600">{f.ciclo ? fmt(haPulv) : '—'}</td>
                            <td className="px-5 py-3 text-campo-600">{fmtFecha(f.ciclo?.fecha_siembra ?? null)}</td>
                            <td className="px-5 py-3 text-campo-600">{fmtFecha(f.ciclo?.fecha_cosecha ?? null)}</td>
                            <td className="px-5 py-3 text-right font-medium text-campo-900">{fmt(f.ciclo?.rinde_kg_ha)}</td>
                            <td className="px-5 py-3 text-center">
                              {f.ciclo && apls.length > 0 ? (
                                <button
                                  onClick={() => toggleExpandido(f.ciclo!.ciclo_id)}
                                  className="text-xs text-lime-700 hover:text-lime-600 font-medium"
                                >
                                  {expandido ? '▲ Ocultar' : `▼ Ver (${apls.length})`}
                                </button>
                              ) : '—'}
                            </td>
                            <td className="px-5 py-3 text-center">
                              {f.ciclo ? (
                                <Link href={`/seguimiento/lotes/${f.ciclo.ciclo_id}`} className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                                  Ver ficha →
                                </Link>
                              ) : (
                                <Link href={`/seguimiento/lotes/nuevo?lote=${f.lote.id}`} className="text-xs text-campo-400 hover:text-lime-700 font-medium">
                                  + Agregar
                                </Link>
                              )}
                            </td>
                          </tr>
                          {/* Fila expandida de pulverizaciones */}
                          {expandido && f.ciclo && (
                            <tr key={`exp-${f.ciclo.ciclo_id}`} className="bg-campo-50/50">
                              <td colSpan={11} className="px-8 py-3">
                                <div className="space-y-1">
                                  {apls
                                    .sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? ''))
                                    .map(a => (
                                      <div key={a.id} className="flex items-start gap-4 text-xs text-campo-600">
                                        <span className="text-campo-400 w-20 shrink-0">{fmtFecha(a.fecha)}</span>
                                        <span className="text-campo-500 w-32 shrink-0">{a.tipo.replace(/_/g, ' ')}</span>
                                        <span className="text-campo-500 w-16 shrink-0 text-right">{fmt(a.superficie_ha)} ha</span>
                                        <span className="text-campo-700">{a.productos.join(', ')}</span>
                                      </div>
                                    ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ─── VISTA POR CULTIVO ──────────────────────────────────────────── */}
      {!loading && vistaSeleccionada === 'cultivo' && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Resumen por Cultivo — {campanaSeleccionada}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Lotes</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha pulverizadas</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Producción (kg)</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde (kg/ha)</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(porCultivo).map(([cultivo, data]) => {
                  const expandido = expandidos.has(-Object.keys(porCultivo).indexOf(cultivo) - 1)
                  const idx = -Object.keys(porCultivo).indexOf(cultivo) - 1
                  return (
                    <>
                      <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-campo-900">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">
                            {cultivo}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-campo-600">{data.ciclos.length}</td>
                        <td className="px-5 py-3 text-right text-campo-600">{fmt(data.haSembrada)}</td>
                        <td className="px-5 py-3 text-right text-campo-600">{data.haCosechada > 0 ? fmt(data.haCosechada) : '—'}</td>
                        <td className="px-5 py-3 text-right text-campo-600">{fmt(data.haPulv)}</td>
                        <td className="px-5 py-3 text-right text-campo-600">{data.kg > 0 ? fmt(data.kg) : '—'}</td>
                        <td className="px-5 py-3 text-right font-medium text-campo-900">
                          {data.haCosechada > 0 ? fmt(data.kg / data.haCosechada) : '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => toggleExpandido(idx)}
                            className="text-xs text-lime-700 hover:text-lime-600 font-medium"
                          >
                            {expandido ? '▲ Ocultar' : '▼ Ver lotes'}
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr key={`exp-${cultivo}`} className="bg-campo-50/50">
                          <td colSpan={8} className="px-8 py-3">
                            <div className="space-y-1">
                              {data.ciclos.map(c => (
                                <div key={c.ciclo_id} className="flex items-center gap-6 text-xs text-campo-600">
                                  <span className="w-32 font-medium text-campo-800">{c.lote}</span>
                                  <span className="w-24">{c.campo}</span>
                                  <span>{fmt(c.sup_sembrada)} ha sembradas</span>
                                  {c.sup_cosechada ? <span>{fmt(c.sup_cosechada)} ha cosechadas</span> : null}
                                  {c.rinde_kg_ha ? <span>{fmt(c.rinde_kg_ha)} kg/ha</span> : null}
                                  <Link href={`/seguimiento/lotes/${c.ciclo_id}`} className="text-lime-700 hover:text-lime-600 font-medium">
                                    Ver ficha →
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
