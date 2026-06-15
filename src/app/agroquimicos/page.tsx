'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

type RegistroInsumo = {
  key: string
  mes: string
  tipo: string
  costo_insumos: number
  aplicacion_id: number
}

type RegistroServicio = {
  key: string
  mes: string
  costo_servicio: number
  aplicacion_id: number
}

// Año fiscal: 01/09/(n-1) al 30/08/(n) → campaña 'YY-YY'
// Sep-Dic de un año pertenecen a la campaña que termina el año siguiente
// Ene-Ago de un año pertenecen a la campaña que empezó el año anterior
function getCampana(fecha: string): string {
  const d = new Date(fecha + 'T00:00:00')
  const anio = d.getFullYear()
  const mes = d.getMonth() + 1 // 1-12
  if (mes >= 9) {
    // Sep-Dic: campaña anio/(anio+1)
    const a1 = String(anio).slice(2)
    const a2 = String(anio + 1).slice(2)
    return `${a1}-${a2}`
  } else {
    // Ene-Ago: campaña (anio-1)/anio
    const a1 = String(anio - 1).slice(2)
    const a2 = String(anio).slice(2)
    return `${a1}-${a2}`
  }
}

// Orden de campaña para sorting
function campanaSort(campana: string): number {
  const [a] = campana.split('-')
  return parseInt(a)
}

function getKey(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesLabel(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// Campaña a la que pertenece un key 'YYYY-MM' (corte: sep = mes 9)
function keyToCampana(key: string): string {
  const [anio, mes] = key.split('-').map(Number)
  if (mes >= 9) {
    return `${String(anio).slice(2)}-${String(anio + 1).slice(2)}`
  } else {
    return `${String(anio - 1).slice(2)}-${String(anio).slice(2)}`
  }
}

// Tipos canónicos del sistema
const TIPOS_CANONICOS = ['herbicida', 'fungicida', 'insecticida', 'acaricida', 'curasemilla', 'coadyuvante', 'otro']

export default function AgroquimicosDashboard() {
  const supabase = createClient()
  const [registrosInsumos, setRegistrosInsumos] = useState<RegistroInsumo[]>([])
  const [registrosServicios, setRegistrosServicios] = useState<RegistroServicio[]>([])
  const [alertas, setAlertas] = useState(0)
  const [totalProductos, setTotalProductos] = useState(0)
  const [campanasDisponibles, setCampanasDisponibles] = useState<string[]>([])
  const [campanasSeleccionadas, setCampanasSeleccionadas] = useState<string[]>([])
  const [tiposDisponibles, setTiposDisponibles] = useState<string[]>([])
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  function toggleCampana(c: string) {
    setCampanasSeleccionadas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function toggleTodasCampanas() {
    setCampanasSeleccionadas(prev => prev.length === campanasDisponibles.length ? [] : [...campanasDisponibles])
  }
  function toggleTipo(tipo: string) {
    setTiposSeleccionados(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo])
  }
  function toggleTodosTipos() {
    setTiposSeleccionados(prev => prev.length === tiposDisponibles.length ? [] : [...tiposDisponibles])
  }

  async function cargar() {
    setLoading(true)

    const [
      { data: stockData },
      { data: usadoData },
      { data: insumos },
      { data: servicios },
      { data: tiposData },
    ] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('producto, stock_actual, stock_minimo, activo'),
      supabase.from('sa_aplicacion_productos').select('producto, dosis_ha, sa_aplicaciones(superficie_ha)'),
      supabase
        .from('sa_aplicacion_productos')
        .select('aplicacion_id, producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(fecha, superficie_ha)'),
      supabase
        .from('sa_aplicaciones')
        .select('id, fecha, costo_servicio_usd_ha, superficie_ha')
        .not('costo_servicio_usd_ha', 'is', null),
      supabase.from('agroquimicos_productos').select('nombre, tipo').eq('activo', true),
    ])

    // Alertas de stock
    const usadoMap: Record<string, number> = {}
    ;(usadoData ?? []).forEach((ap: any) => {
      const nombre = ap.producto?.trim().toLowerCase()
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      if (nombre) usadoMap[nombre] = (usadoMap[nombre] ?? 0) + dosis * sup
    })
    const lista = (stockData ?? []).filter((r: any) => r.activo)
    setAlertas(lista.filter((r: any) => {
      const stockActual = Number(r.stock_actual ?? 0)
      const totalUsado = usadoMap[r.producto?.trim().toLowerCase()] ?? 0
      return (totalUsado > 0 && stockActual < totalUsado * 0.1) || (r.stock_minimo > 0 && stockActual <= Number(r.stock_minimo))
    }).length)
    setTotalProductos(lista.length)

    // Mapa nombre → tipo de producto (normalizado a minúscula)
    const tipoMap: Record<string, string> = {}
    ;(tiposData ?? []).forEach((p: any) => {
      const nombreNorm = p.nombre?.trim().toLowerCase()
      const tipoNorm = p.tipo?.trim().toLowerCase() ?? 'otro'
      if (nombreNorm) tipoMap[nombreNorm] = tipoNorm
    })

    // ── Registros de INSUMOS (uno por producto-aplicación) ──
    const regsInsumos: RegistroInsumo[] = []
    ;(insumos ?? []).forEach((ap: any) => {
      const fecha = ap.sa_aplicaciones?.fecha
      if (!fecha) return
      const key = getKey(fecha)
      const mes = getMesLabel(fecha)
      const nombreNorm = ap.producto?.trim().toLowerCase()
      const tipo = tipoMap[nombreNorm] ?? 'otro'
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      regsInsumos.push({ key, mes, tipo, costo_insumos: costoInsumo, aplicacion_id: ap.aplicacion_id })
    })
    setRegistrosInsumos(regsInsumos)

    // ── Registros de SERVICIO (uno por aplicación, independiente del tipo de producto) ──
    const regsServicios: RegistroServicio[] = []
    ;(servicios ?? []).forEach((a: any) => {
      const fecha = a.fecha
      if (!fecha) return
      const key = getKey(fecha)
      const mes = getMesLabel(fecha)
      const costoServicio = Number(a.costo_servicio_usd_ha ?? 0) * Number(a.superficie_ha ?? 0)
      if (costoServicio > 0) {
        regsServicios.push({ key, mes, costo_servicio: costoServicio, aplicacion_id: a.id })
      }
    })
    setRegistrosServicios(regsServicios)

    // Campañas disponibles (de ambos conjuntos)
    const todasKeys = Array.from(new Set([
      ...regsInsumos.map(r => r.key),
      ...regsServicios.map(r => r.key),
    ]))
    const campanas = Array.from(new Set(todasKeys.map(keyToCampana)))
      .sort((a, b) => campanaSort(a) - campanaSort(b))
    setCampanasDisponibles(campanas)
    setCampanasSeleccionadas(campanas)

    // Tipos disponibles — solo los que tienen datos en insumos, en orden canónico
    const tiposEnDatos = new Set(regsInsumos.map(r => r.tipo))
    const tipos = TIPOS_CANONICOS.filter(t => tiposEnDatos.has(t))
    setTiposDisponibles(tipos)
    setTiposSeleccionados(tipos)

    setLoading(false)
  }

  // Calcular datos filtrados
  const datosFiltrados = useMemo(() => {
    // Insumos: filtrar por campaña Y tipo
    const insumosFiltrados = registrosInsumos.filter(r => {
      const campana = keyToCampana(r.key)
      const campanaOk = campanasSeleccionadas.length === 0 || campanasSeleccionadas.includes(campana)
      const tipoOk = tiposSeleccionados.length === 0 || tiposSeleccionados.includes(r.tipo)
      return campanaOk && tipoOk
    })

    // Servicios: filtrar SOLO por campaña (no por tipo — son independientes del producto)
    // Además, solo incluir aplicaciones que tengan al menos un insumo en el filtro actual
    const aplIdsConInsumos = new Set(insumosFiltrados.map(r => r.aplicacion_id))
    const serviciosFiltrados = registrosServicios.filter(r => {
      const campana = keyToCampana(r.key)
      const campanaOk = campanasSeleccionadas.length === 0 || campanasSeleccionadas.includes(campana)
      // Solo mostrar servicio si la aplicación tiene insumos en el filtro actual
      return campanaOk && aplIdsConInsumos.has(r.aplicacion_id)
    })

    // Agrupar por mes
    const mesesMap: Record<string, {
      mes: string
      costo_insumos: number
      costo_servicio: number
      aplicaciones: Set<number>
    }> = {}

    insumosFiltrados.forEach(r => {
      if (!mesesMap[r.key]) mesesMap[r.key] = { mes: r.mes, costo_insumos: 0, costo_servicio: 0, aplicaciones: new Set() }
      mesesMap[r.key].costo_insumos += r.costo_insumos
      mesesMap[r.key].aplicaciones.add(r.aplicacion_id)
    })

    serviciosFiltrados.forEach(r => {
      if (!mesesMap[r.key]) mesesMap[r.key] = { mes: r.mes, costo_insumos: 0, costo_servicio: 0, aplicaciones: new Set() }
      mesesMap[r.key].costo_servicio += r.costo_servicio
      mesesMap[r.key].aplicaciones.add(r.aplicacion_id)
    })

    return Object.entries(mesesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        mes: v.mes,
        costo_insumos: Math.round(v.costo_insumos),
        costo_servicio: Math.round(v.costo_servicio),
        costo_total: Math.round(v.costo_insumos + v.costo_servicio),
        aplicaciones: v.aplicaciones.size,
      }))
  }, [registrosInsumos, registrosServicios, campanasSeleccionadas, tiposSeleccionados])

  const totalInsumos = datosFiltrados.reduce((acc, d) => acc + d.costo_insumos, 0)
  const totalServicio = datosFiltrados.reduce((acc, d) => acc + d.costo_servicio, 0)
  const totalAplicaciones = datosFiltrados.reduce((acc, d) => acc + d.aplicaciones, 0)

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`

  const TIPO_COLORS: Record<string, string> = {
    herbicida: '#059669',
    fungicida: '#8b5cf6',
    insecticida: '#ef4444',
    coadyuvante: '#f59e0b',
    curasemilla: '#3b82f6',
    acaricida: '#ec4899',
    otro: '#6b7280',
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-campo-200 rounded-lg px-4 py-3 shadow-lg text-sm space-y-1">
        <div className="font-semibold text-campo-900 mb-2">{label}</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-campo-600">{p.name}:</span>
            <span className="font-medium text-campo-900">
              {p.dataKey === 'aplicaciones' ? p.value : fmtUsd(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Costos y aplicaciones por campaña</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{totalProductos}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
        </div>
        <div className={`card p-5 ${alertas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Alertas stock</div>
          <div className={`text-2xl font-bold ${alertas > 0 ? 'text-red-600' : 'text-campo-900'}`}>{alertas}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo el 10% histórico</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo insumos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalInsumos)}</div>
          <div className="text-xs text-campo-400 mt-0.5">filtro aplicado</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo servicio</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalServicio)}</div>
          <div className="text-xs text-campo-400 mt-0.5">pulverización</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-campo-600 uppercase tracking-wider w-20">Campaña</span>
          <button onClick={toggleTodasCampanas}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${campanasSeleccionadas.length === campanasDisponibles.length ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
            Todas
          </button>
          {campanasDisponibles.map(c => (
            <button key={c} onClick={() => toggleCampana(c)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${campanasSeleccionadas.includes(c) ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-campo-600 uppercase tracking-wider w-20">Tipo</span>
          <button onClick={toggleTodosTipos}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${tiposSeleccionados.length === tiposDisponibles.length ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
            Todos
          </button>
          {tiposDisponibles.map(tipo => (
            <button key={tipo} onClick={() => toggleTipo(tipo)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${tiposSeleccionados.includes(tipo) ? 'text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}
              style={tiposSeleccionados.includes(tipo) ? { backgroundColor: TIPO_COLORS[tipo] ?? '#059669' } : {}}>
              {tipo}
            </button>
          ))}
        </div>
      </div>

      {/* Gráfico */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-campo-900">Costos mensuales de aplicaciones</h2>
            <p className="text-xs text-campo-400 mt-0.5">Insumos + Servicio de pulverización</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-campo-500">Costo total período</div>
            <div className="text-lg font-bold text-campo-900">{fmtUsd(totalInsumos + totalServicio)}</div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={datosFiltrados} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis yAxisId="usd" orientation="left" tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="apl" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="usd" dataKey="costo_insumos" name="Insumos (USD)" stackId="costos" fill="#059669" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="usd" dataKey="costo_servicio" name="Servicio pulv. (USD)" stackId="costos" fill="#34d399" radius={[4, 4, 0, 0]} />
            <Line yAxisId="apl" type="monotone" dataKey="aplicaciones" name="Q Aplicaciones" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Tabla resumen */}
        <div className="mt-6 border-t border-campo-100 pt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-campo-500">
                <th className="text-left py-1 font-semibold">Mes</th>
                <th className="text-right py-1 font-semibold">Q Aplic.</th>
                <th className="text-right py-1 font-semibold">Costo insumos</th>
                <th className="text-right py-1 font-semibold">Costo servicio</th>
                <th className="text-right py-1 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.map((d, i) => (
                <tr key={i} className="border-t border-campo-50">
                  <td className="py-1.5 text-campo-700 font-medium">{d.mes}</td>
                  <td className="py-1.5 text-right text-campo-600">{d.aplicaciones}</td>
                  <td className="py-1.5 text-right text-campo-600">{fmtUsd(d.costo_insumos)}</td>
                  <td className="py-1.5 text-right text-campo-600">{fmtUsd(d.costo_servicio)}</td>
                  <td className="py-1.5 text-right font-medium text-campo-900">{fmtUsd(d.costo_total)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-campo-200 font-semibold">
                <td className="py-1.5 text-campo-900">Total</td>
                <td className="py-1.5 text-right text-campo-900">{totalAplicaciones}</td>
                <td className="py-1.5 text-right text-campo-900">{fmtUsd(totalInsumos)}</td>
                <td className="py-1.5 text-right text-campo-900">{fmtUsd(totalServicio)}</td>
                <td className="py-1.5 text-right text-campo-900">{fmtUsd(totalInsumos + totalServicio)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
