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

type Acondicionamiento = {
  ciclo_id: number
  superficie_ha: number
}

const TIPO_LABELS: Record<string, string> = {
  barbecho: 'Barbecho',
  pre_siembra: 'Pre-siembra',
  pre_emergente: 'Pre-Emergente',
  post_emergente_temprano: 'Post-Emerg. Temprano',
  post_emergente: 'Post-Emergente',
  rescate: 'Rescate',
  desecacion: 'Desecación',
  insecticida: 'Insecticida',
  fungicida: 'Fungicida',
}

export default function LotesCultivosPage() {
  const supabase = createClient()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [acondicionamientos, setAcondicionamientos] = useState<Acondicionamiento[]>([])
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
      const [{ data: ls }, { data: cs }, { data: caps }, { data: apls }, { data: prods }, { data: acons }] = await Promise.all([
        supabase.from('lotes').select('*').eq('activo', true).order('establecimiento').order('nombre'),
        supabase.from('vw_sa_resumen_ciclo').select('*'),
        supabase.from('campanas').select('nombre').order('nombre', { ascending: false }),
        supabase.from('sa_aplicaciones').select('id, ciclo_id, tipo, fecha, superficie_ha'),
        supabase.from('sa_aplicacion_productos').select('aplicacion_id, producto'),
        supabase.from('sa_acondicionamiento').select('ciclo_id, superficie_ha'),
      ])

      setLotes(ls ?? [])
      setCiclos(cs ?? [])
      setAcondicionamientos(acons ?? [])

      const prodsMap: Record<number, string[]> = {}
      ;(prods ?? []).forEach((p: any) => {
        if (!prodsMap[p.aplicacion_id]) prodsMap[p.aplicacion_id] = []
        if (!prodsMap[p.aplicacion_id].includes(p.producto))
          prodsMap[p.aplicacion_id].push(p.producto)
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

  const getCiclos = (loteNombre: string) => ciclosCampana.filter(c => c.lote === loteNombre)
  const getAplicaciones = (cicloId: number) => aplicaciones.filter(a => a.ciclo_id === cicloId)
  const getHaPulv = (cicloId: number) => aplicaciones.filter(a => a.ciclo_id === cicloId).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)
  const getHaAcon = (cicloId: number) => acondicionamientos.filter(a => a.ciclo_id === cicloId).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)

  const toggleExpandido = (id: number) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const fmt = (n: number | null | undefined, dec = 1) =>
    n != null && Number(n) > 0 ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'

  const fmtFecha = (s: string | null) =>
    s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

  const lotesFiltrados = lotes.filter(l => {
    if (filtroCampo && l.establecimiento !== filtroCampo) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return l.nombre.toLowerCase().includes(q) || getCiclos(l.nombre).some(c => c.cultivo.toLowerCase().includes(q))
    }
    return true
  })

  type Fila = { lote: Lote; ciclo: Ciclo | null }
  const filas: Fila[] = []
  lotesFiltrados.forEach(l => {
    const cs = getCiclos(l.nombre)
    if (cs.length === 0) filas.push({ lote: l, ciclo: null })
    else cs.forEach(c => filas.push({ lote: l, ciclo: c }))
  })

  const filasPorCampo = filas.reduce((acc: Record<string, Fila[]>, f) => {
    if (!acc[f.lote.establecimiento]) acc[f.lote.establecimiento] = []
    acc[f.lote.establecimiento].push(f)
    return acc
  }, {})

  const porCultivo = ciclosCampana
    .filter(c => lotesFiltrados.some(l => l.nombre === c.lote))
    .reduce((acc: Record<string, { ciclos: Ciclo[]; haSembrada: number; haCosechada: number; haPulv: number; kg: number }>, c) => {
      if (!acc[c.cultivo]) acc[c.cultivo] = { ciclos: [], haSembrada: 0, haCosechada: 0, haPulv: 0, kg: 0 }
      acc[c.cultivo].ciclos.push(c)
      acc[c.cultivo].haSembrada += Number(c.sup_sembrada ?? 0)
      acc[c.cultivo].haCosechada += Number(c.sup_cosechada ?? 0)
      acc[c.cultivo].haPulv += getHaPulv(c.ciclo_id)
      acc[c.cultivo].kg += Number(c.rinde_kg_ha && c.sup_cosechada ? c.rinde_kg_ha * c.sup_cosechada : 0)
      return acc
    }, {})

  const totalLotesConCiclo = new Set(filas.filter(f => f.ciclo).map(f => f.lote.nombre)).size

  // Columnas de la tabla de lotes (11 columnas)
  const COL_WIDTHS = ['w-28', 'w-16', 'w-24', 'w-24', 'w-28', 'w-28', 'w-24', 'w-24', 'w-24', 'w-24', 'w-24']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Lotes / Cultivos</h1>
          <p className="text-campo-500 text-sm mt-0.5">
            {totalLotesConCiclo} de {lotesFiltrados.length} lotes con ciclo en {campanaSeleccionada}
          </p>
        </div>
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
          <select value={campanaSeleccionada} onChange={e => setCampanaSeleccionada(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            {campanas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-campo-600 mr-2">Campo</label>
          <select value={filtroCampo} onChange={e => setFiltroCampo(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Todos</option>
            {campos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            className="text-xs text-campo-400 hover:text-campo-700 px-2 py-1.5 rounded-lg hover:bg-campo-100 transition-colors">
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
                      <th className="text-left px-4 py-3 font-semibold text-campo-700">Lote</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Ha lote</th>
                      <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Ha sembradas</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Ha pulverizadas</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Ha acondicionadas</th>
                      <th className="text-left px-4 py-3 font-semibold text-campo-700">Siembra</th>
                      <th className="text-left px-4 py-3 font-semibold text-campo-700">Cosecha</th>
                      <th className="text-right px-4 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                      <th className="text-center px-4 py-3 font-semibold text-campo-700">Aplicaciones</th>
                      <th className="text-center px-4 py-3 font-semibold text-campo-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fs.map((f) => {
                      const apls = f.ciclo ? getAplicaciones(f.ciclo.ciclo_id).sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '')) : []
                      const haPulv = f.ciclo ? getHaPulv(f.ciclo.ciclo_id) : 0
                      const expandido = f.ciclo ? expandidos.has(f.ciclo.ciclo_id) : false
                      return (
                        <>
                          <tr key={`${f.lote.id}-${f.ciclo?.ciclo_id ?? 'sin'}`} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-campo-900">{f.lote.nombre}</td>
                            <td className="px-4 py-3 text-right text-campo-600">{fmt(f.lote.hectareas)}</td>
                            <td className="px-4 py-3">
                              {f.ciclo ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">{f.ciclo.cultivo}</span>
                              ) : (
                                <span className="text-campo-400 text-xs">Sin ciclo</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-campo-600">{f.ciclo ? fmt(f.ciclo.sup_sembrada) : '—'}</td>
                            <td className="px-4 py-3 text-right text-campo-600">{f.ciclo?.sup_cosechada ? fmt(f.ciclo.sup_cosechada) : '—'}</td>
                            <td className="px-4 py-3 text-right text-campo-600">{f.ciclo ? fmt(haPulv) : '—'}</td>
                            <td className="px-4 py-3 text-right text-campo-600">{f.ciclo ? (getHaAcon(f.ciclo.ciclo_id) > 0 ? fmt(getHaAcon(f.ciclo.ciclo_id)) : '—') : '—'}</td>
                            <td className="px-4 py-3 text-campo-600">{fmtFecha(f.ciclo?.fecha_siembra ?? null)}</td>
                            <td className="px-4 py-3 text-campo-600">{fmtFecha(f.ciclo?.fecha_cosecha ?? null)}</td>
                            <td className="px-4 py-3 text-right font-medium text-campo-900">{fmt(f.ciclo?.rinde_kg_ha)}</td>
                            <td className="px-4 py-3 text-center">
                              {f.ciclo && apls.length > 0 ? (
                                <button onClick={() => toggleExpandido(f.ciclo!.ciclo_id)}
                                  className="text-xs text-campo-500 hover:text-lime-700 font-medium">
                                  {expandido ? '▲ Ocultar' : `▼ Ver (${apls.length})`}
                                </button>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {f.ciclo ? (
                                <Link href={`/seguimiento/lotes/${f.ciclo.ciclo_id}`}
                                  className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                                  Ver ficha →
                                </Link>
                              ) : (
                                <Link href={`/seguimiento/lotes/nuevo?lote=${f.lote.id}`}
                                  className="text-xs text-campo-400 hover:text-lime-700 font-medium">
                                  + Agregar
                                </Link>
                              )}
                            </td>
                          </tr>
                          {/* Fila expandida */}
                          {expandido && f.ciclo && (
                            <tr key={`exp-${f.ciclo.ciclo_id}`} className="bg-campo-50/30 border-b border-campo-50">
                              <td colSpan={12} className="px-4 py-2">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-campo-400">
                                      <th className="text-left py-1 pr-4 font-medium w-24">Fecha</th>
                                      <th className="text-left py-1 pr-4 font-medium w-36">Tipo</th>
                                      <th className="text-right py-1 pr-4 font-medium w-20">Ha</th>
                                      <th className="text-left py-1 font-medium">Productos</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {apls.map(a => (
                                      <tr key={a.id} className="border-t border-campo-100/50">
                                        <td className="py-1 pr-4 text-campo-500 w-24">{fmtFecha(a.fecha)}</td>
                                        <td className="py-1 pr-4 text-campo-600 w-36">{TIPO_LABELS[a.tipo] ?? a.tipo}</td>
                                        <td className="py-1 pr-4 text-right text-campo-500 w-20">{fmt(a.superficie_ha)}</td>
                                        <td className="py-1 text-campo-700">{a.productos.join(', ')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
                {Object.entries(porCultivo).map(([cultivo, data], idx) => {
                  const expandido = expandidos.has(-(idx + 1))
                  return (
                    <>
                      <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-campo-900">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-lime-100 text-lime-800">{cultivo}</span>
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
                          <button onClick={() => toggleExpandido(-(idx + 1))}
                            className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                            {expandido ? '▲ Ocultar' : '▼ Ver lotes'}
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr key={`exp-${cultivo}`} className="bg-campo-50/30 border-b border-campo-50">
                          <td colSpan={8} className="px-5 py-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-campo-400">
                                  <th className="text-left py-1 pr-4 font-medium w-32">Lote</th>
                                  <th className="text-left py-1 pr-4 font-medium w-32">Campo</th>
                                  <th className="text-right py-1 pr-4 font-medium w-24">Ha sembradas</th>
                                  <th className="text-right py-1 pr-4 font-medium w-24">Ha cosechadas</th>
                                  <th className="text-right py-1 pr-4 font-medium w-24">Rinde kg/ha</th>
                                  <th className="text-center py-1 font-medium w-20">Ficha</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.ciclos.map(c => (
                                  <tr key={c.ciclo_id} className="border-t border-campo-100/50">
                                    <td className="py-1 pr-4 font-medium text-campo-800 w-32">{c.lote}</td>
                                    <td className="py-1 pr-4 text-campo-500 w-32">{c.campo}</td>
                                    <td className="py-1 pr-4 text-right text-campo-600 w-24">{fmt(c.sup_sembrada)}</td>
                                    <td className="py-1 pr-4 text-right text-campo-600 w-24">{c.sup_cosechada ? fmt(c.sup_cosechada) : '—'}</td>
                                    <td className="py-1 pr-4 text-right text-campo-600 w-24">{c.rinde_kg_ha ? fmt(c.rinde_kg_ha) : '—'}</td>
                                    <td className="py-1 text-center w-20">
                                      <Link href={`/seguimiento/lotes/${c.ciclo_id}`}
                                        className="text-lime-700 hover:text-lime-600 font-medium">
                                        Ver ficha →
                                      </Link>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
