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

  // Eje X fijo: sep(0) oct(1) nov(2) dic(3) ene(4) feb(5) mar(6) abr(7) may(8) jun(9) jul(10) ago(11)
  const MESES_LABELS = ['sep', 'oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago']
  // Índice fiscal de un key YYYY-MM (0=sep, 11=ago)
  function mesIndexFiscal(key: string): number {
    const mes = parseInt(key.split('-')[1]) // 1-12
    return mes >= 9 ? mes - 9 : mes + 3  // sep=0, oct=1, ..., dic=3, ene=4, ..., ago=11
  }

  // Colores por campaña
  const CAMPANA_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  // Calcular datos filtrados — estructura por mes fiscal con una entrada por campaña
  const { datosFiltrados, campanasEnGrafico } = useMemo(() => {
    const campanas = campanasSeleccionadas.length > 0 ? campanasSeleccionadas : campanasDisponibles

    // Por cada campaña, acumular insumos y servicios por índice de mes fiscal (0-11)
    const porCampana: Record<string, { insumos: number[]; servicio: number[]; aplicaciones: Set<number>[] }> = {}
    campanas.forEach(c => {
      porCampana[c] = {
        insumos: Array(12).fill(0),
        servicio: Array(12).fill(0),
        aplicaciones: Array.from({ length: 12 }, () => new Set<number>()),
      }
    })

    // Insumos filtrados por campaña y tipo
    registrosInsumos.forEach(r => {
      const campana = keyToCampana(r.key)
      if (!porCampana[campana]) return
      const tipoOk = tiposSeleccionados.length === 0 || tiposSeleccionados.includes(r.tipo)
      if (!tipoOk) return
      const idx = mesIndexFiscal(r.key)
      porCampana[campana].insumos[idx] += r.costo_insumos
      porCampana[campana].aplicaciones[idx].add(r.aplicacion_id)
    })

    // Servicios filtrados por campaña — solo para aplicaciones con insumos en filtro
    const aplIdsConInsumos = new Set(
      registrosInsumos
        .filter(r => {
          const campana = keyToCampana(r.key)
          const campanaOk = campanas.includes(campana)
          const tipoOk = tiposSeleccionados.length === 0 || tiposSeleccionados.includes(r.tipo)
          return campanaOk && tipoOk
        })
        .map(r => r.aplicacion_id)
    )
    registrosServicios.forEach(r => {
      const campana = keyToCampana(r.key)
      if (!porCampana[campana]) return
      if (!aplIdsConInsumos.has(r.aplicacion_id)) return
      const idx = mesIndexFiscal(r.key)
      porCampana[campana].servicio[idx] += r.costo_servicio
      porCampana[campana].aplicaciones[idx].add(r.aplicacion_id)
    })

    // Construir array de 12 filas (sep..ago), cada fila tiene un valor por campaña
    const datos = MESES_LABELS.map((label, idx) => {
      const fila: Record<string, number> = { mes_idx: idx }
      fila.mes = idx as any
      campanas.forEach(c => {
        fila[`insumos_${c}`] = Math.round(porCampana[c].insumos[idx])
        fila[`servicio_${c}`] = Math.round(porCampana[c].servicio[idx])
        fila[`apl_${c}`] = porCampana[c].aplicaciones[idx].size
      })
      fila.mesLabel = idx as any
      return { ...fila, mesLabel: label }
    })

    return { datosFiltrados: datos, campanasEnGrafico: campanas }
  }, [registrosInsumos, registrosServicios, campanasSeleccionadas, campanasDisponibles, tiposSeleccionados])

  const totalInsumos = campanasEnGrafico.reduce((acc, c) =>
    acc + datosFiltrados.reduce((s, d) => s + (d[`insumos_${c}`] as number ?? 0), 0), 0)
  const totalServicio = campanasEnGrafico.reduce((acc, c) =>
    acc + datosFiltrados.reduce((s, d) => s + (d[`servicio_${c}`] as number ?? 0), 0), 0)
  const totalAplicaciones = campanasEnGrafico.reduce((acc, c) =>
    acc + datosFiltrados.reduce((s, d) => s + (d[`apl_${c}`] as number ?? 0), 0), 0)



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
            <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis yAxisId="usd" orientation="left" tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="apl" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {campanasEnGrafico.map((c, i) => {
              const color = CAMPANA_COLORS[i % CAMPANA_COLORS.length]
              // Variante más clara para servicio: mezcla con blanco
              const colorClaro = color + '99'
              return [
                <Bar key={`ins_${c}`} yAxisId="usd" dataKey={`insumos_${c}`} name={`Insumos ${c}`} stackId={c} fill={color} radius={[0, 0, 0, 0]} />,
                <Bar key={`srv_${c}`} yAxisId="usd" dataKey={`servicio_${c}`} name={`Servicio ${c}`} stackId={c} fill={colorClaro} radius={[4, 4, 0, 0]} />,
              ]
            })}
            {campanasEnGrafico.map((c, i) => (
              <Line key={`apl_${c}`} yAxisId="apl" type="monotone" dataKey={`apl_${c}`} name={`Q Aplic. ${c}`}
                stroke={CAMPANA_COLORS[i % CAMPANA_COLORS.length]} strokeWidth={2}
                dot={{ fill: CAMPANA_COLORS[i % CAMPANA_COLORS.length], r: 3 }} strokeDasharray={i > 0 ? '4 2' : undefined} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Tabla resumen por campaña */}
        <div className="mt-6 border-t border-campo-100 pt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-campo-500">
                <th className="text-left py-1 font-semibold">Mes</th>
                {campanasEnGrafico.map(c => (
                  <th key={c} className="text-right py-1 font-semibold" colSpan={3}>{c}</th>
                ))}
              </tr>
              <tr className="text-campo-400">
                <th />
                {campanasEnGrafico.map(c => (
                  [
                    <th key={`ih_${c}`} className="text-right py-1">Insumos</th>,
                    <th key={`sh_${c}`} className="text-right py-1">Servicio</th>,
                    <th key={`th_${c}`} className="text-right py-1 pr-4">Total</th>,
                  ]
                ))}
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.map((d, i) => (
                <tr key={i} className="border-t border-campo-50">
                  <td className="py-1.5 text-campo-700 font-medium">{d.mesLabel}</td>
                  {campanasEnGrafico.map(c => {
                    const ins = d[`insumos_${c}`] as number ?? 0
                    const srv = d[`servicio_${c}`] as number ?? 0
                    return [
                      <td key={`i_${c}`} className="py-1.5 text-right text-campo-600">{ins > 0 ? fmtUsd(ins) : '—'}</td>,
                      <td key={`s_${c}`} className="py-1.5 text-right text-campo-600">{srv > 0 ? fmtUsd(srv) : '—'}</td>,
                      <td key={`t_${c}`} className="py-1.5 text-right font-medium text-campo-900 pr-4">{ins + srv > 0 ? fmtUsd(ins + srv) : '—'}</td>,
                    ]
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-campo-200 font-semibold">
                <td className="py-1.5 text-campo-900">Total</td>
                {campanasEnGrafico.map(c => {
                  const ins = datosFiltrados.reduce((s, d) => s + (d[`insumos_${c}`] as number ?? 0), 0)
                  const srv = datosFiltrados.reduce((s, d) => s + (d[`servicio_${c}`] as number ?? 0), 0)
                  return [
                    <td key={`ti_${c}`} className="py-1.5 text-right text-campo-900">{fmtUsd(ins)}</td>,
                    <td key={`ts_${c}`} className="py-1.5 text-right text-campo-900">{fmtUsd(srv)}</td>,
                    <td key={`tt_${c}`} className="py-1.5 text-right text-campo-900 pr-4">{fmtUsd(ins + srv)}</td>,
                  ]
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
