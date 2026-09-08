'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

type RegistroInsumo = {
  key: string
  tipo: string
  costo_insumos: number
  aplicacion_id: number
  campana: string
  cultivo: string
  producto: string
  unidad: string
  dosis_ha: number
  superficie_ha: number
}

type RegistroServicio = {
  key: string
  costo_servicio: number
  aplicacion_id: number
  campana: string
}

// Año fiscal: 01/09/(n-1) al 30/08/(n) → campaña 'YY-YY'
// Sep-Dic de un año pertenecen a la campaña que termina el año siguiente
// Ene-Ago de un año pertenecen a la campaña que empezó el año anterior
function getKey(fecha: string) {
  const d = new Date(fecha + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

// Orden de campaña para sorting
function campanaSort(campana: string): number {
  const [a] = campana.split('-')
  return parseInt(a)
}

// Tipos canónicos del sistema
const TIPOS_CANONICOS = ['herbicida', 'fungicida', 'insecticida', 'acaricida', 'curasemilla', 'coadyuvante', 'otro']

export default function AgroquimicosDashboard() {
  const supabase = createClient()
  const [registrosInsumos, setRegistrosInsumos] = useState<RegistroInsumo[]>([])
  const [registrosServicios, setRegistrosServicios] = useState<RegistroServicio[]>([])
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
      { data: insumos },
      { data: servicios },
      { data: productosData },
      { data: campanasData },
    ] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('producto, activo'),
      supabase
        .from('sa_aplicacion_productos')
        .select('aplicacion_id, producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(fecha, superficie_ha, sa_ciclos!inner(campanas!inner(nombre), cultivos(nombre)))')
        .limit(10000),
      supabase
        .from('sa_aplicaciones')
        .select('id, fecha, costo_servicio_usd_ha, superficie_ha, sa_ciclos!inner(campanas!inner(nombre))')
        .not('costo_servicio_usd_ha', 'is', null),
      supabase.from('agroquimicos_productos').select('nombre, tipo, unidad').eq('activo', true),
      supabase.from('campanas').select('nombre').order('nombre'),
    ])

    setTotalProductos((stockData ?? []).filter((r: any) => r.activo).length)

    // Mapas nombre → tipo / unidad de producto (normalizado a minúscula)
    const tipoMap: Record<string, string> = {}
    const unidadMap: Record<string, string> = {}
    ;(productosData ?? []).forEach((p: any) => {
      const nombreNorm = p.nombre?.trim().toLowerCase()
      if (!nombreNorm) return
      tipoMap[nombreNorm] = p.tipo?.trim().toLowerCase() ?? 'otro'
      unidadMap[nombreNorm] = p.unidad ?? ''
    })

    // ── Registros de INSUMOS (uno por producto-aplicación) ──
    const regsInsumos: RegistroInsumo[] = []
    ;(insumos ?? []).forEach((ap: any) => {
      const fecha = ap.sa_aplicaciones?.fecha
      if (!fecha) return
      const key = getKey(fecha)
      const nombreNorm = ap.producto?.trim().toLowerCase()
      const tipo = tipoMap[nombreNorm] ?? 'otro'
      const dosisHa = Number(ap.dosis_ha ?? 0)
      const superficieHa = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * dosisHa * superficieHa
      const campana = ap.sa_aplicaciones?.sa_ciclos?.campanas?.nombre ?? keyToCampana(key)
      const cultivo = ap.sa_aplicaciones?.sa_ciclos?.cultivos?.nombre ?? 'Sin cultivo'
      regsInsumos.push({
        key,
        tipo,
        costo_insumos: costoInsumo,
        aplicacion_id: ap.aplicacion_id,
        campana,
        cultivo,
        producto: ap.producto,
        unidad: unidadMap[nombreNorm] ?? '',
        dosis_ha: dosisHa,
        superficie_ha: superficieHa,
      })
    })
    setRegistrosInsumos(regsInsumos)

    // ── Registros de SERVICIO (uno por aplicación, independiente del tipo de producto) ──
    const regsServicios: RegistroServicio[] = []
    ;(servicios ?? []).forEach((a: any) => {
      const fecha = a.fecha
      if (!fecha) return
      const key = getKey(fecha)
      const costoServicio = Number(a.costo_servicio_usd_ha ?? 0) * Number(a.superficie_ha ?? 0)
      const campana = a.sa_ciclos?.campanas?.nombre ?? keyToCampana(key)
      if (costoServicio > 0) {
        regsServicios.push({ key, costo_servicio: costoServicio, aplicacion_id: a.id, campana })
      }
    })
    setRegistrosServicios(regsServicios)

    // Campañas disponibles — desde tabla campanas (siempre todas, aunque no tengan datos)
    const campanas = (campanasData ?? [])
      .map((c: any) => c.nombre)
      .filter((n: string) => n)
      .sort((a: string, b: string) => campanaSort(a) - campanaSort(b))
    setCampanasDisponibles(campanas)
    setCampanasSeleccionadas(campanas)

    // Tipos disponibles — solo los que tienen datos en insumos, en orden canónico
    const tiposEnDatos = new Set(regsInsumos.map(r => r.tipo))
    const tipos = TIPOS_CANONICOS.filter(t => tiposEnDatos.has(t))
    setTiposDisponibles(tipos)
    setTiposSeleccionados(tipos)

    setLoading(false)
  }

  const TIPO_COLORS: Record<string, string> = {
    herbicida: '#059669',
    fungicida: '#8b5cf6',
    insecticida: '#ef4444',
    coadyuvante: '#f59e0b',
    curasemilla: '#3b82f6',
    acaricida: '#ec4899',
    otro: '#6b7280',
  }

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const fmtCantidad = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  // Insumos filtrados por campaña y tipo seleccionados
  const insumosFiltrados = useMemo(() => {
    const campanas = campanasSeleccionadas.length > 0 ? campanasSeleccionadas : campanasDisponibles
    return registrosInsumos.filter(r =>
      campanas.includes(r.campana) &&
      (tiposSeleccionados.length === 0 || tiposSeleccionados.includes(r.tipo))
    )
  }, [registrosInsumos, campanasSeleccionadas, campanasDisponibles, tiposSeleccionados])

  const totalInsumos = useMemo(() => insumosFiltrados.reduce((s, r) => s + r.costo_insumos, 0), [insumosFiltrados])

  const totalServicio = useMemo(() => {
    const campanas = campanasSeleccionadas.length > 0 ? campanasSeleccionadas : campanasDisponibles
    const aplIdsConInsumos = new Set(insumosFiltrados.map(r => r.aplicacion_id))
    return registrosServicios
      .filter(r => campanas.includes(r.campana) && aplIdsConInsumos.has(r.aplicacion_id))
      .reduce((s, r) => s + r.costo_servicio, 0)
  }, [registrosServicios, insumosFiltrados, campanasSeleccionadas, campanasDisponibles])

  // Agrupado por cultivo → producto: cantidad usada, dosis/ha, costo unitario, costo total
  const porCultivo = useMemo(() => {
    type Acc = { cantidad: number; ha: number; costo: number; unidad: string }
    const map: Record<string, Record<string, Acc>> = {}
    insumosFiltrados.forEach(r => {
      if (!map[r.cultivo]) map[r.cultivo] = {}
      if (!map[r.cultivo][r.producto]) map[r.cultivo][r.producto] = { cantidad: 0, ha: 0, costo: 0, unidad: r.unidad }
      const acc = map[r.cultivo][r.producto]
      acc.cantidad += r.dosis_ha * r.superficie_ha
      acc.ha += r.superficie_ha
      acc.costo += r.costo_insumos
    })

    return Object.entries(map)
      .map(([cultivo, productos]) => {
        const filas = Object.entries(productos)
          .map(([producto, a]) => ({
            producto,
            unidad: a.unidad,
            cantidadPorHa: a.ha > 0 ? a.cantidad / a.ha : 0,
            costoPorHa: a.ha > 0 ? a.costo / a.ha : 0,
            hectareas: a.ha,
            costoTotal: a.costo,
          }))
          .sort((x, y) => y.costoTotal - x.costoTotal)
        const costoTotalCultivo = filas.reduce((s, f) => s + f.costoTotal, 0)
        return { cultivo, filas, costoTotalCultivo }
      })
      .sort((a, b) => b.costoTotalCultivo - a.costoTotalCultivo)
  }, [insumosFiltrados])

  // Datos para el gráfico: costo por cultivo, apilado por tipo de producto
  const datosChart = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    insumosFiltrados.forEach(r => {
      if (!map[r.cultivo]) map[r.cultivo] = {}
      map[r.cultivo][r.tipo] = (map[r.cultivo][r.tipo] ?? 0) + r.costo_insumos
    })
    return Object.entries(map)
      .map(([cultivo, tipos]) => ({ cultivo, ...tipos, total: Object.values(tipos).reduce((s, v) => s + v, 0) }))
      .sort((a, b) => b.total - a.total)
  }, [insumosFiltrados])

  const tiposEnGrafico = tiposSeleccionados.length > 0 ? tiposSeleccionados : tiposDisponibles

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const filtrados = payload.filter((p: any) => (p.value ?? 0) > 0)
    const total = filtrados.reduce((s: number, p: any) => s + p.value, 0)
    return (
      <div className="bg-white border border-campo-200 rounded-lg px-4 py-3 shadow-lg text-sm space-y-1">
        <div className="font-semibold text-campo-900 mb-2">{label}</div>
        {filtrados.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-campo-600 capitalize">{p.dataKey}:</span>
            <span className="font-medium text-campo-900">{fmtUsd(p.value)}</span>
          </div>
        ))}
        <div className="border-t border-campo-100 mt-1 pt-1 flex items-center justify-between gap-4">
          <span className="text-campo-500">Total</span>
          <span className="font-semibold text-campo-900">{fmtUsd(total)}</span>
        </div>
      </div>
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Costos de insumos por cultivo y campaña</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{totalProductos}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
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

      {/* Gráfico + detalle por cultivo */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-campo-900">Costo de insumos por cultivo</h2>
            <p className="text-xs text-campo-400 mt-0.5">Cantidad y costo por hectárea (promedio ponderado por superficie), hectáreas tratadas y costo total por producto</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-campo-500">Costo total insumos</div>
            <div className="text-lg font-bold text-campo-900">{fmtUsd(totalInsumos)}</div>
          </div>
        </div>

        {datosChart.length === 0 ? (
          <div className="text-center text-campo-400 py-16 text-sm">No hay datos para el filtro seleccionado</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(220, datosChart.length * 42)}>
              <BarChart data={datosChart} layout="vertical" margin={{ top: 5, right: 24, left: 8, bottom: 5 }} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="cultivo" width={110} tick={{ fontSize: 11, fill: '#374151' }} />
                <Tooltip content={<CustomTooltip />} />
                {tiposEnGrafico.map((tipo, i) => (
                  <Bar
                    key={tipo}
                    dataKey={tipo}
                    name={tipo}
                    stackId="costo"
                    fill={TIPO_COLORS[tipo] ?? '#6b7280'}
                    radius={i === tiposEnGrafico.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>

            {/* Detalle por cultivo y producto */}
            <div className="mt-6 border-t border-campo-100 pt-4 space-y-5">
              {porCultivo.map(pc => (
                <div key={pc.cultivo}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-campo-800">{pc.cultivo}</h3>
                    <span className="text-sm font-semibold text-campo-900">{fmtUsd(pc.costoTotalCultivo)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-campo-500 border-b border-campo-100">
                          <th className="text-left py-1.5 font-semibold">Producto</th>
                          <th className="text-right py-1.5 font-semibold">Cantidad (por ha)</th>
                          <th className="text-right py-1.5 font-semibold">Costo (por ha)</th>
                          <th className="text-right py-1.5 font-semibold">Hectáreas</th>
                          <th className="text-right py-1.5 font-semibold pr-1">Costo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pc.filas.map(f => (
                          <tr key={f.producto} className="border-b border-campo-50">
                            <td className="py-1.5 text-campo-700">{f.producto}</td>
                            <td className="py-1.5 text-right text-campo-600">{fmtCantidad(f.cantidadPorHa)} {f.unidad}/ha</td>
                            <td className="py-1.5 text-right text-campo-600">
                              {f.costoPorHa.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/ha
                            </td>
                            <td className="py-1.5 text-right text-campo-600">{fmtCantidad(f.hectareas)} ha</td>
                            <td className="py-1.5 text-right font-medium text-campo-900 pr-1">{fmtUsd(f.costoTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
