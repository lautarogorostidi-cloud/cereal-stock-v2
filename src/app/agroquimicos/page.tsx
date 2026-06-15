'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

type DatoMes = {
  mes: string
  costo_insumos: number
  costo_servicio: number
  costo_total: number
  aplicaciones: number
}

export default function AgroquimicosDashboard() {
  const supabase = createClient()
  const [datosMensuales, setDatosMensuales] = useState<DatoMes[]>([])
  const [alertas, setAlertas] = useState(0)
  const [totalProductos, setTotalProductos] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const [{ data: productos }, { data: usadoData }, { data: insumos }, { data: servicios }] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('producto, stock_actual, stock_minimo, activo'),
      supabase.from('sa_aplicacion_productos').select('producto, dosis_ha, sa_aplicaciones(superficie_ha)'),
      supabase.from('sa_aplicacion_productos').select('dosis_ha, costo_unitario, sa_aplicaciones!inner(fecha, superficie_ha)').gte('sa_aplicaciones.fecha', '2025-01-01'),
      supabase.from('sa_aplicaciones').select('fecha, costo_servicio_usd_ha, superficie_ha').gte('fecha', '2025-01-01').not('costo_servicio_usd_ha', 'is', null),
    ])

    // Alertas
    const usadoMap: Record<string, number> = {}
    ;(usadoData ?? []).forEach((ap: any) => {
      const nombre = ap.producto?.trim().toLowerCase()
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      if (nombre) usadoMap[nombre] = (usadoMap[nombre] ?? 0) + dosis * sup
    })
    const lista = (productos ?? []).filter((r: any) => r.activo)
    const alertasCount = lista.filter((r: any) => {
      const stockActual = Number(r.stock_actual ?? 0)
      const totalUsado = usadoMap[r.producto?.trim().toLowerCase()] ?? 0
      return (totalUsado > 0 && stockActual < totalUsado * 0.1) || (r.stock_minimo > 0 && stockActual <= Number(r.stock_minimo))
    }).length
    setAlertas(alertasCount)
    setTotalProductos(lista.length)

    // Datos mensuales — costo insumos
    const mesesMap: Record<string, DatoMes> = {}
    const getKey = (fecha: string) => {
      const d = new Date(fecha + 'T00:00:00')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
    const getMesLabel = (fecha: string) => {
      const d = new Date(fecha + 'T00:00:00')
      return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
    }
    const getOrCreate = (key: string, fecha: string): DatoMes => {
      if (!mesesMap[key]) mesesMap[key] = { mes: getMesLabel(fecha), costo_insumos: 0, costo_servicio: 0, costo_total: 0, aplicaciones: 0 }
      return mesesMap[key]
    }

    ;(insumos ?? []).forEach((ap: any) => {
      const fecha = ap.sa_aplicaciones?.fecha
      if (!fecha) return
      const key = getKey(fecha)
      const item = getOrCreate(key, fecha)
      item.costo_insumos += Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
    })

    ;(servicios ?? []).forEach((a: any) => {
      if (!a.fecha) return
      const key = getKey(a.fecha)
      const item = getOrCreate(key, a.fecha)
      item.costo_servicio += Number(a.costo_servicio_usd_ha ?? 0) * Number(a.superficie_ha ?? 0)
      item.aplicaciones += 1
    })

    const datos = Object.entries(mesesMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        ...v,
        costo_insumos: Math.round(v.costo_insumos),
        costo_servicio: Math.round(v.costo_servicio),
        costo_total: Math.round(v.costo_insumos + v.costo_servicio),
      }))

    setDatosMensuales(datos)
    setLoading(false)
  }

  const totalInsumos = datosMensuales.reduce((acc, d) => acc + d.costo_insumos, 0)
  const totalServicio = datosMensuales.reduce((acc, d) => acc + d.costo_servicio, 0)
  const totalAplicaciones = datosMensuales.reduce((acc, d) => acc + d.aplicaciones, 0)

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`

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
        <p className="text-campo-500 text-sm mt-0.5">Costos y aplicaciones desde enero 2025</p>
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
          <div className="text-xs text-campo-400 mt-0.5">desde ene 2025</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo servicio</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalServicio)}</div>
          <div className="text-xs text-campo-400 mt-0.5">pulverización</div>
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
          <ComposedChart data={datosMensuales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <YAxis yAxisId="usd" orientation="left" tick={{ fontSize: 11, fill: '#6b7280' }}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="apl" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar yAxisId="usd" dataKey="costo_insumos" name="Insumos (USD)" stackId="costos"
              fill="#059669" radius={[0, 0, 0, 0]} />
            <Bar yAxisId="usd" dataKey="costo_servicio" name="Servicio pulverización (USD)" stackId="costos"
              fill="#34d399" radius={[4, 4, 0, 0]} />
            <Line yAxisId="apl" type="monotone" dataKey="aplicaciones" name="Q Aplicaciones"
              stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} />
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
              {datosMensuales.map((d, i) => (
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
