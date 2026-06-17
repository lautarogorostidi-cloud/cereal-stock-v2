'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Costo = {
  id: number
  establecimiento: string
  campana_id: number
  campana_nombre: string
  tipo: string
  periodo: string
  monto_total: number
  observaciones: string | null
  vencimientos: Vencimiento[]
}

type Vencimiento = {
  id: number
  costo_id: number
  fecha_vencimiento: string
  monto: number
  pagado: boolean
  es_estimado: boolean
}

type Campana = { id: number; nombre: string }

const TIPO_LABELS: Record<string, string> = {
  arrendamiento: 'Arrendamiento',
  seguro: 'Seguro',
  asesoramiento: 'Asesoramiento',
  impuesto: 'Impuesto',
  costo_oportunidad: 'Costo de oportunidad',
  otro: 'Otro',
}

const TIPO_COLORS: Record<string, string> = {
  arrendamiento: 'bg-blue-100 text-blue-800',
  seguro: 'bg-purple-100 text-purple-800',
  asesoramiento: 'bg-lime-100 text-lime-800',
  impuesto: 'bg-red-100 text-red-800',
  costo_oportunidad: 'bg-amber-100 text-amber-800',
  otro: 'bg-campo-100 text-campo-700',
}

const MESES_FISCAL = ['sep', 'oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago']

function getMesFiscalIdx(fecha: string): number {
  const mes = new Date(fecha + 'T00:00:00').getMonth() + 1
  return mes >= 9 ? mes - 9 : mes + 3
}

function getMesAnio(fecha: string, campana: string): string {
  const d = new Date(fecha + 'T00:00:00')
  const anioInicio = 2000 + parseInt(campana.split('-')[0])
  const mes = d.getMonth() + 1
  const anio = mes >= 9 ? anioInicio : anioInicio + 1
  return `${MESES_FISCAL[getMesFiscalIdx(fecha)]} ${String(anio).slice(2)}`
}

export default function CostosPage() {
  const supabase = createClient()
  const [costos, setCostos] = useState<Costo[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<number | null>(null)
  const [establecimientos, setEstablecimientos] = useState<string[]>([])
  const [filtroEstablecimiento, setFiltroEstablecimiento] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: camps }, { data: costosData }, { data: vencData }, { data: lotesData }] = await Promise.all([
      supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
      supabase.from('costos_fijos_campo').select('*').order('created_at', { ascending: false }),
      supabase.from('costos_fijos_vencimientos').select('*').order('fecha_vencimiento'),
      supabase.from('lotes').select('establecimiento').eq('activo', true),
    ])

    setCampanas(camps ?? [])
    if (camps && camps.length > 0) setCampanaSeleccionada(camps[0].id)

    const establs = Array.from(new Set((lotesData ?? []).map((l: any) => l.establecimiento))).sort() as string[]
    setEstablecimientos(establs)

    const vencMap: Record<number, Vencimiento[]> = {}
    ;(vencData ?? []).forEach((v: any) => {
      if (!vencMap[v.costo_id]) vencMap[v.costo_id] = []
      vencMap[v.costo_id].push(v)
    })

    const campMap: Record<number, string> = {}
    ;(camps ?? []).forEach((c: any) => { campMap[c.id] = c.nombre })

    setCostos((costosData ?? []).map((c: any) => ({
      ...c,
      campana_nombre: campMap[c.campana_id] ?? '',
      vencimientos: vencMap[c.id] ?? [],
    })))

    setLoading(false)
  }

  async function eliminar(id: number) {
    if (!confirm('¿Eliminár este costo y todos sus vencimientos?')) return
    setDeletingId(id)
    await supabase.from('costos_fijos_campo').delete().eq('id', id)
    await cargar()
    setDeletingId(null)
  }

  async function togglePagado(vencId: number, pagado: boolean) {
    await supabase.from('costos_fijos_vencimientos').update({ pagado: !pagado }).eq('id', vencId)
    await cargar()
  }

  const costosFiltrados = useMemo(() => {
    return costos.filter(c => {
      if (campanaSeleccionada && c.campana_id !== campanaSeleccionada) return false
      if (filtroEstablecimiento && c.establecimiento !== filtroEstablecimiento) return false
      return true
    })
  }, [costos, campanaSeleccionada, filtroEstablecimiento])

  const campanaActual = campanas.find(c => c.id === campanaSeleccionada)

  // KPIs
  const totalCostos = costosFiltrados.reduce((acc, c) => acc + Number(c.monto_total), 0)
  const hoy = new Date().toISOString().split('T')[0]
  const proximos30 = costosFiltrados.flatMap(c => c.vencimientos).filter(v => !v.pagado && v.fecha_vencimiento >= hoy && v.fecha_vencimiento <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0])
  const vencidosSinPagar = costosFiltrados.flatMap(c => c.vencimientos).filter(v => !v.pagado && v.fecha_vencimiento < hoy)
  const totalProximos = proximos30.reduce((acc, v) => acc + Number(v.monto), 0)
  const totalVencidos = vencidosSinPagar.reduce((acc, v) => acc + Number(v.monto), 0)

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const fmtFecha = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-AR')

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Costos Fijos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Arrendamiento, seguro, asesoramiento y otros por campo</p>
        </div>
        <Link href="/seguimiento/costos/nuevo"
          className="bg-lime-600 hover:bg-lime-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
          + Nuevo costo
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div>
          <label className="text-xs font-medium text-campo-600 mr-2">Campaña</label>
          <select value={campanaSeleccionada ?? ''} onChange={e => setCampanaSeleccionada(Number(e.target.value))}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-campo-600 mr-2">Campo</label>
          <select value={filtroEstablecimiento} onChange={e => setFiltroEstablecimiento(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Todos</option>
            {establecimientos.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total costos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalCostos)}</div>
          <div className="text-xs text-campo-400 mt-0.5">período seleccionado</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Registros</div>
          <div className="text-2xl font-bold text-campo-900">{costosFiltrados.length}</div>
          <div className="text-xs text-campo-400 mt-0.5">costos cargados</div>
        </div>
        <div className={`card p-5 ${totalProximos > 0 ? 'border-amber-200 bg-amber-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Próximos 30 días</div>
          <div className={`text-2xl font-bold ${totalProximos > 0 ? 'text-amber-600' : 'text-campo-900'}`}>{fmtUsd(totalProximos)}</div>
          <div className="text-xs text-campo-400 mt-0.5">{proximos30.length} vencimientos</div>
        </div>
        <div className={`card p-5 ${totalVencidos > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Vencidos sin pagar</div>
          <div className={`text-2xl font-bold ${totalVencidos > 0 ? 'text-red-600' : 'text-campo-900'}`}>{fmtUsd(totalVencidos)}</div>
          <div className="text-xs text-campo-400 mt-0.5">{vencidosSinPagar.length} vencimientos</div>
        </div>
      </div>

      {/* Cronograma visual */}
      {costosFiltrados.length > 0 && campanaActual && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Cronograma de vencimientos — {campanaActual.nombre}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-4 py-2 font-semibold text-campo-700 w-32">Campo</th>
                  <th className="text-left px-4 py-2 font-semibold text-campo-700 w-36">Tipo</th>
                  {MESES_FISCAL.map(m => (
                    <th key={m} className="text-center px-2 py-2 font-semibold text-campo-500 w-16">{m}</th>
                  ))}
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {costosFiltrados.map(c => {
                  const montosPorMes: Record<number, { monto: number; pagado: boolean; id: number; es_estimado: boolean }[]> = {}
                  c.vencimientos.forEach(v => {
                    const idx = getMesFiscalIdx(v.fecha_vencimiento)
                    if (!montosPorMes[idx]) montosPorMes[idx] = []
                    montosPorMes[idx].push({ monto: v.monto, pagado: v.pagado, id: v.id, es_estimado: v.es_estimado })
                  })
                  return (
                    <tr key={c.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                      <td className="px-4 py-2 font-medium text-campo-900">{c.establecimiento}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[c.tipo] ?? 'bg-campo-100 text-campo-700'}`}>
                          {TIPO_LABELS[c.tipo] ?? c.tipo}
                        </span>
                      </td>
                      {MESES_FISCAL.map((_, idx) => {
                        const vencs = montosPorMes[idx] ?? []
                        if (vencs.length === 0) return <td key={idx} className="px-2 py-2 text-center text-campo-200">—</td>
                        const total = vencs.reduce((s, v) => s + v.monto, 0)
                        const todosPagados = vencs.every(v => v.pagado)
                        const esEstimado = vencs.some(v => v.es_estimado)
                        const colorClass = todosPagados
                          ? 'bg-emerald-100 text-emerald-700'
                          : esEstimado
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                        return (
                          <td key={idx} className="px-2 py-2 text-center">
                            <button onClick={() => togglePagado(vencs[0].id, vencs[0].pagado)}
                              className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${colorClass}`}
                              title={todosPagados ? 'Pagado' : esEstimado ? 'Estimado — click para marcar pagado' : 'Pendiente — click para marcar pagado'}>
                              {Math.round(total).toLocaleString('es-AR')}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(c.monto_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2 border-t border-campo-100 bg-campo-50 flex gap-4 text-xs text-campo-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 inline-block"/> Pagado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 inline-block"/> Estimado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block"/> Pendiente real</span>
            <span className="text-campo-400">— click para marcar como pagado</span>
          </div>
        </div>
      )}

      {/* Tabla detalle */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
          <h2 className="font-semibold text-campo-700 text-sm">Detalle de costos</h2>
        </div>
        {costosFiltrados.length === 0 ? (
          <div className="px-5 py-10 text-center text-campo-400">No hay costos registrados para esta campaña</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Campo</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Período</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Monto total</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Vencimientos</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Observaciones</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {costosFiltrados.map(c => (
                  <tr key={c.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-campo-900">{c.establecimiento}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[c.tipo] ?? 'bg-campo-100 text-campo-700'}`}>
                        {TIPO_LABELS[c.tipo] ?? c.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-campo-600 capitalize">{c.periodo}</td>
                    <td className="px-5 py-3 text-right font-medium text-campo-900">{fmtUsd(c.monto_total)}</td>
                    <td className="px-5 py-3 text-campo-600 text-xs">
                      {c.vencimientos.map(v => (
                        <div key={v.id} className="flex items-center gap-1">
                          <span className={v.pagado ? 'text-emerald-600' : v.fecha_vencimiento < hoy ? 'text-red-600' : 'text-campo-600'}>
                            {fmtFecha(v.fecha_vencimiento)} — {fmtUsd(v.monto)} {v.pagado ? '✓' : ''}
                          </span>
                        </div>
                      ))}
                    </td>
                    <td className="px-5 py-3 text-campo-500 text-xs">{c.observaciones ?? '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/seguimiento/costos/${c.id}/editar`}
                          className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                          Editar
                        </Link>
                        <button onClick={() => eliminar(c.id)} disabled={deletingId === c.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
                          {deletingId === c.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
