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

export default function DashboardClient({ stockData, comprometidoData, campanias, cultivos }: Props) {
  const campaniaActiva = campanias.find(c => c.activa)?.nombre ?? campanias[0]?.nombre ?? ''
  const [campania, setCampania] = useState<string>(campaniaActiva)
  const [cultivoFiltro, setCultivoFiltro] = useState<string>('todos')

  const datosFiltrados = useMemo(() => {
    return stockData.filter(r => {
      const matchC = campania === 'todas' || r.campania === campania
      const matchCu = cultivoFiltro === 'todos' || r.cultivo === cultivoFiltro
      return matchC && matchCu
    })
  }, [stockData, campania, cultivoFiltro])

  const comprometidoFiltrado = useMemo(() => {
    return comprometidoData.filter(r => {
      const matchC = campania === 'todas' || r.campania === campania
      const matchCu = cultivoFiltro === 'todos' || r.cultivo === cultivoFiltro
      return matchC && matchCu
    })
  }, [comprometidoData, campania, cultivoFiltro])

  // Combinar stock con comprometido
  const datosConComprometido = useMemo(() => {
    return datosFiltrados.map(r => {
      const comp = comprometidoFiltrado.find(c => c.cultivo === r.cultivo)
      return { ...r, ton_comprometidas_real: Number(comp?.ton_comprometidas ?? 0) }
    })
  }, [datosFiltrados, comprometidoFiltrado])

  const kpis = useMemo(() => {
    const disponible = datosConComprometido.reduce((s, r) => s + Number(r.stock_disponible), 0)
    const entregado = datosConComprometido.reduce((s, r) => s + Number(r.ton_entregadas), 0)
    const comprometido = datosConComprometido.reduce((s, r) => s + r.ton_comprometidas_real, 0)
    const margen = disponible - comprometido
    return { disponible, entregado, comprometido, margen }
  }, [datosConComprometido])

  const chartData = useMemo(() => {
    return datosConComprometido
      .filter(r => Number(r.stock_disponible) > 0 || r.ton_comprometidas_real > 0 || Number(r.ton_entregadas) > 0)
      .map(r => ({
        cultivo: r.cultivo,
        'Disponible': Math.max(0, Number(r.stock_disponible)),
        'Entregado': Number(r.ton_entregadas),
        'Comprometido': r.ton_comprometidas_real,
      }))
  }, [datosConComprometido])

  const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  const fmtD = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Dashboard Comercial</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición por campaña y cultivo</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select value={campania} onChange={e => setCampania(e.target.value)} className="input-field w-40 text-sm">
            <option value="todas">Todas las campañas</option>
            {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}{c.activa ? ' ✓' : ''}</option>)}
          </select>
          <select value={cultivoFiltro} onChange={e => setCultivoFiltro(e.target.value)} className="input-field w-44 text-sm">
            <option value="todos">Todos los cultivos</option>
            {cultivos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border bg-campo-50 border-campo-200 p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-campo-500" /><span className="text-xs font-semibold uppercase tracking-wider text-campo-500">Stock Disponible</span></div>
          <div className="text-2xl font-bold text-campo-800">{fmt(kpis.disponible)} tn</div>
          <div className="text-xs text-campo-500 mt-1">Entradas - Salidas</div>
        </div>
        <div className="rounded-2xl border bg-blue-50 border-blue-200 p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-xs font-semibold uppercase tracking-wider text-blue-500">Entregado</span></div>
          <div className="text-2xl font-bold text-blue-800">{fmt(kpis.entregado)} tn</div>
          <div className="text-xs text-blue-500 mt-1">Descargas de CPE</div>
        </div>
        <div className="rounded-2xl border bg-orange-50 border-orange-200 p-5">
          <div className="flex items-center gap-2 mb-3"><div className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-xs font-semibold uppercase tracking-wider text-orange-500">Comprometido</span></div>
          <div className="text-2xl font-bold text-orange-800">{fmt(kpis.comprometido)} tn</div>
          <div className="text-xs text-orange-500 mt-1">Contratos pendientes</div>
        </div>
        <div className={`rounded-2xl border p-5 ${kpis.margen >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${kpis.margen >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${kpis.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>Margen para vender</span>
          </div>
          <div className={`text-2xl font-bold ${kpis.margen >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmt(kpis.margen)} tn</div>
          <div className={`text-xs mt-1 ${kpis.margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.margen >= 0 ? 'Disponible - Comprometido' : '⚠️ Posición negativa'}
          </div>
        </div>
      </div>

      {/* Gráfico + Tabla */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Posición por Cultivo</h2>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d0dab2" />
                <XAxis dataKey="cultivo" tick={{ fontSize: 10, fill: '#587029' }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#8fa854' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #d0dab2', fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString('es-AR')} tn`]} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Disponible" fill="#8fa854" radius={[4,4,0,0]} />
                <Bar dataKey="Entregado" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Comprometido" fill="#f97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-campo-400 py-8 text-center">Sin datos</p>
          )}
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-800">Detalle por Cultivo</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-campo-600">Cultivo</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-campo-600">Disponible</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-blue-600">Entregado</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-orange-600">Comprometido</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-campo-600">Margen</th>
                </tr>
              </thead>
              <tbody>
                {datosConComprometido.filter(r => Number(r.stock_disponible) > 0 || r.ton_comprometidas_real > 0).map((r, i) => {
                  const margen = Number(r.stock_disponible) - r.ton_comprometidas_real
                  return (
                    <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50">
                      <td className="px-4 py-2 font-medium text-campo-900">{r.cultivo}</td>
                      <td className="px-4 py-2 text-right text-campo-700">{fmtD(Number(r.stock_disponible))}</td>
                      <td className="px-4 py-2 text-right text-blue-600">{fmtD(Number(r.ton_entregadas))}</td>
                      <td className="px-4 py-2 text-right text-orange-600">{fmtD(r.ton_comprometidas_real)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${margen >= 0 ? 'text-campo-600' : 'text-red-500'}`}>{fmtD(margen)}</td>
                    </tr>
                  )
                })}
                {datosConComprometido.filter(r => Number(r.stock_disponible) > 0 || r.ton_comprometidas_real > 0).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-campo-400">Sin datos para los filtros seleccionados</td></tr>
                )}
              </tbody>
              {datosConComprometido.filter(r => Number(r.stock_disponible) > 0 || r.ton_comprometidas_real > 0).length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-campo-200 bg-campo-50">
                    <td className="px-4 py-2 font-bold text-campo-800">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-campo-800">{fmtD(kpis.disponible)}</td>
                    <td className="px-4 py-2 text-right font-bold text-blue-700">{fmtD(kpis.entregado)}</td>
                    <td className="px-4 py-2 text-right font-bold text-orange-700">{fmtD(kpis.comprometido)}</td>
                    <td className={`px-4 py-2 text-right font-bold ${kpis.margen >= 0 ? 'text-campo-700' : 'text-red-600'}`}>{fmtD(kpis.margen)}</td>
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
