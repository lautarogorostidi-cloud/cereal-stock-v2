'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StockRow {
  campania: string
  cultivo: string
  cultivo_codigo: string
  ton_cosechadas: number
  ton_vendidas: number
  ton_entregadas: number
  stock_disponible: number
  ton_comprometidas: number
}

interface ComprRow {
  campania: string
  cultivo: string
  ton_comprometidas: number
}

interface Props {
  stockData: StockRow[]
  comprometidoData: ComprRow[]
  campanias: any[]
  cultivos: any[]
}

const COLORS = {
  disponible: '#587029',
  entregado: '#3b82f6',
  comprometido: '#f97316',
  margen: '#16a34a',
}

export default function DashboardClient({ stockData, comprometidoData, campanias, cultivos }: Props) {
  const campaniaActiva = campanias.find(c => c.activa)?.nombre ?? campanias[0]?.nombre ?? ''

  const [campaniasSel, setCampaniasSel] = useState<string[]>([campaniaActiva])
  const [cultivosSel, setCultivosSel] = useState<string[]>(['todos'])

  function toggleCampania(nombre: string) {
    setCampaniasSel(prev =>
      prev.includes(nombre) ? prev.filter(c => c !== nombre) : [...prev, nombre]
    )
  }

  function toggleCultivo(nombre: string) {
    if (nombre === 'todos') {
      setCultivosSel(['todos'])
      return
    }
    setCultivosSel(prev => {
      const sinTodos = prev.filter(c => c !== 'todos')
      if (sinTodos.includes(nombre)) {
        const next = sinTodos.filter(c => c !== nombre)
        return next.length === 0 ? ['todos'] : next
      }
      return [...sinTodos, nombre]
    })
  }

  const datosFiltrados = useMemo(() => {
    return stockData.filter(r => {
      const matchC = campaniasSel.includes(r.campania)
      const matchCu = cultivosSel.includes('todos') || cultivosSel.includes(r.cultivo)
      return matchC && matchCu
    })
  }, [stockData, campaniasSel, cultivosSel])

  const comprometidoFiltrado = useMemo(() => {
    return comprometidoData.filter(r => {
      const matchC = campaniasSel.includes(r.campania)
      const matchCu = cultivosSel.includes('todos') || cultivosSel.includes(r.cultivo)
      return matchC && matchCu
    })
  }, [comprometidoData, campaniasSel, cultivosSel])

  const datosAgrupados = useMemo(() => {
    const map: Record<string, { disponible: number; entregado: number; comprometido: number; cosechado: number }> = {}
    datosFiltrados.forEach(r => {
      if (!map[r.cultivo]) map[r.cultivo] = { disponible: 0, entregado: 0, comprometido: 0, cosechado: 0 }
      map[r.cultivo].disponible += Number(r.stock_disponible)
      map[r.cultivo].entregado += Number(r.ton_entregadas)
      map[r.cultivo].cosechado += Number(r.ton_cosechadas)
    })
    comprometidoFiltrado.forEach(r => {
      if (!map[r.cultivo]) map[r.cultivo] = { disponible: 0, entregado: 0, comprometido: 0, cosechado: 0 }
      map[r.cultivo].comprometido += Number(r.ton_comprometidas)
    })
    return map
  }, [datosFiltrados, comprometidoFiltrado])

  const kpis = useMemo(() => {
    const vals = Object.values(datosAgrupados)
    const disponible = vals.reduce((s, r) => s + r.disponible, 0)
    const entregado = vals.reduce((s, r) => s + r.entregado, 0)
    const comprometido = vals.reduce((s, r) => s + r.comprometido, 0)
    const cosechado = vals.reduce((s, r) => s + r.cosechado, 0)
    const margen = disponible - comprometido
    return { disponible, entregado, comprometido, margen, cosechado }
  }, [datosAgrupados])

  const chartData = useMemo(() => {
    return Object.entries(datosAgrupados)
      .filter(([, v]) => v.disponible > 0 || v.comprometido > 0 || v.entregado > 0)
      .map(([cultivo, v]) => ({
        cultivo,
        'Disponible': Math.max(0, v.disponible),
        'Entregado': v.entregado,
        'Comprometido': v.comprometido,
      }))
      .sort((a, b) => b['Disponible'] - a['Disponible'])
  }, [datosAgrupados])

  const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const fmtD = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const Gauge = ({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) => {
    const r = size * 0.38
    const cx = size / 2
    const cy = size / 2
    const startAngle = Math.PI
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const endAngle = startAngle + Math.PI
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const filledAngle = startAngle + (Math.PI * Math.min(pct, 100) / 100)
    const x3 = cx + r * Math.cos(filledAngle)
    const y3 = cy + r * Math.sin(filledAngle)
    const large = pct > 50 ? 1 : 0

    return (
      <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
          fill="none" stroke="#e5e7eb" strokeWidth={size * 0.08} strokeLinecap="round" />
        {pct > 0 && (
          <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x3} ${y3}`}
            fill="none" stroke={color} strokeWidth={size * 0.08} strokeLinecap="round" />
        )}
      </svg>
    )
  }

  const pctVendido = kpis.cosechado > 0 ? (kpis.entregado / kpis.cosechado) * 100 : 0
  const pctComprometido = kpis.cosechado > 0 ? (kpis.comprometido / kpis.cosechado) * 100 : 0
  const pctDisponible = kpis.cosechado > 0 ? (kpis.disponible / kpis.cosechado) * 100 : 0
  const pctMargen = kpis.cosechado > 0 ? (Math.max(0, kpis.margen) / kpis.cosechado) * 100 : 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Dashboard Comercial</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición consolidada de stock y comercialización</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-6">
        <div>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-2">Campaña</div>
          <div className="flex gap-2 flex-wrap">
            {campanias.map(c => (
              <button key={c.nombre} type="button" onClick={() => toggleCampania(c.nombre)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  campaniasSel.includes(c.nombre)
                    ? 'bg-campo-600 text-white border-campo-600'
                    : 'bg-white text-campo-600 border-campo-200 hover:bg-campo-50'
                }`}>
                {c.nombre}{c.activa ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-2">Cultivo</div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => toggleCultivo('todos')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                cultivosSel.includes('todos')
                  ? 'bg-campo-600 text-white border-campo-600'
                  : 'bg-white text-campo-600 border-campo-200 hover:bg-campo-50'
              }`}>
              Todos
            </button>
            {cultivos.map(c => (
              <button key={c.nombre} type="button" onClick={() => toggleCultivo(c.nombre)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  cultivosSel.includes(c.nombre)
                    ? 'bg-campo-600 text-white border-campo-600'
                    : 'bg-white text-campo-600 border-campo-200 hover:bg-campo-50'
                }`}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Stock Campo y Acopio', value: kpis.disponible, sub: 'Entradas - Salidas', pct: pctDisponible, color: COLORS.disponible, bg: 'bg-campo-50', border: 'border-campo-200', textColor: 'text-campo-800', subColor: 'text-campo-500' },
          { label: 'Entregado', value: kpis.entregado, sub: 'Descargas de CPE', pct: pctVendido, color: COLORS.entregado, bg: 'bg-blue-50', border: 'border-blue-200', textColor: 'text-blue-800', subColor: 'text-blue-500' },
          { label: 'Pendiente de Entrega', value: kpis.comprometido, sub: 'Contratos pendientes', pct: pctComprometido, color: COLORS.comprometido, bg: 'bg-orange-50', border: 'border-orange-200', textColor: 'text-orange-800', subColor: 'text-orange-500' },
          { label: 'Margen para vender', value: kpis.margen, sub: 'Disponible - Comprometido', pct: pctMargen, color: kpis.margen >= 0 ? COLORS.margen : '#ef4444', bg: kpis.margen >= 0 ? 'bg-green-50' : 'bg-red-50', border: kpis.margen >= 0 ? 'border-green-200' : 'border-red-200', textColor: kpis.margen >= 0 ? 'text-green-800' : 'text-red-700', subColor: kpis.margen >= 0 ? 'text-green-500' : 'text-red-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-2xl border ${kpi.bg} ${kpi.border} p-5 flex flex-col items-center text-center`}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: kpi.color }}>{kpi.label}</div>
            <Gauge pct={kpi.pct} color={kpi.color} size={90} />
            <div className={`text-xl font-bold mt-1 ${kpi.textColor}`}>{fmt(kpi.value)} tn</div>
            <div className={`text-xs mt-0.5 ${kpi.subColor}`}>{kpi.sub}</div>
            <div className={`text-xs font-semibold mt-1 ${kpi.subColor}`}>{kpi.pct.toFixed(1)}% del cosechado</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card lg:col-span-3">
          <h2 className="font-semibold text-campo-800 mb-5 text-base">Posición por Cultivo</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(chartData.length * 60, 200)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 90, bottom: 0 }}
                barSize={14}
                barGap={3}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `${(v/1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="cultivo" tick={{ fontSize: 13, fill: '#374151', fontWeight: 500 }} width={85} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #d1d5db', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(v: number, name: string) => [`${v.toLocaleString('es-AR')} tn`, name]}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Legend wrapperStyle={{ fontSize: 13, paddingTop: 16, fontWeight: 500 }} iconType="circle" iconSize={10} />
                <Bar dataKey="Disponible" fill={COLORS.disponible} radius={[0,4,4,0]} />
                <Bar dataKey="Entregado" fill={COLORS.entregado} radius={[0,4,4,0]} />
                <Bar dataKey="Comprometido" fill={COLORS.comprometido} radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-campo-400 text-sm">
              Sin datos para los filtros seleccionados
            </div>
          )}
        </div>

        <div className="card overflow-hidden p-0 lg:col-span-2">
          <div className="px-5 py-4 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-800 text-base">Detalle por Cultivo</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-campo-600">Cultivo</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold" style={{ color: COLORS.disponible }}>Dispon.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold" style={{ color: COLORS.entregado }}>Entreg.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold" style={{ color: COLORS.comprometido }}>Pend.</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-campo-600">Margen</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(datosAgrupados)
                  .filter(([, v]) => v.disponible > 0 || v.comprometido > 0)
                  .sort(([, a], [, b]) => b.disponible - a.disponible)
                  .map(([cultivo, v]) => {
                    const margen = v.disponible - v.comprometido
                    return (
                      <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/60 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-campo-900 text-xs">{cultivo}</td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium" style={{ color: COLORS.disponible }}>{fmtD(v.disponible)}</td>
                        <td className="px-3 py-2.5 text-right text-xs" style={{ color: COLORS.entregado }}>{fmtD(v.entregado)}</td>
                        <td className="px-3 py-2.5 text-right text-xs" style={{ color: COLORS.comprometido }}>{fmtD(v.comprometido)}</td>
                        <td className={`px-3 py-2.5 text-right text-xs font-semibold ${margen >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtD(margen)}</td>
                      </tr>
                    )
                  })}
                {Object.keys(datosAgrupados).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-campo-400 text-xs">Sin datos</td></tr>
                )}
              </tbody>
              {Object.keys(datosAgrupados).length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-campo-200 bg-campo-50">
                    <td className="px-4 py-2.5 font-bold text-campo-800 text-xs">Total</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs" style={{ color: COLORS.disponible }}>{fmtD(kpis.disponible)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs" style={{ color: COLORS.entregado }}>{fmtD(kpis.entregado)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-xs" style={{ color: COLORS.comprometido }}>{fmtD(kpis.comprometido)}</td>
                    <td className={`px-3 py-2.5 text-right font-bold text-xs ${kpis.margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtD(kpis.margen)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}