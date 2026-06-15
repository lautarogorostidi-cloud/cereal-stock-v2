'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AgroquimicosDashboard() {
  const supabase = createClient()
  const [stockData, setStockData] = useState<any[]>([])
  const [movimientosData, setMovimientosData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: stock }, { data: movimientos }, { data: usadoData }] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('*'),
      supabase.from('agroquimicos_movimientos')
        .select('*, agroquimicos_productos(nombre, unidad)')
        .order('fecha', { ascending: false })
        .limit(5),
      supabase.from('sa_aplicacion_productos').select('producto, dosis_ha, sa_aplicaciones(superficie_ha)'),
    ])

    // Calcular uso histórico por producto
    const usadoMap: Record<string, number> = {}
    ;(usadoData ?? []).forEach((ap: any) => {
      const nombre = ap.producto?.trim().toLowerCase()
      const superficie = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      if (nombre) usadoMap[nombre] = (usadoMap[nombre] ?? 0) + dosis * superficie
    })

    // Agregar alerta inteligente al stock
    const stockConAlerta = (stock ?? []).map((r: any) => {
      const stockActual = Number(r.stock_actual ?? 0)
      const nombreNorm = r.producto?.trim().toLowerCase()
      const totalUsado = usadoMap[nombreNorm] ?? 0
      const alertaPct = totalUsado > 0 && stockActual < totalUsado * 0.1
      const alertaMinimo = r.stock_minimo > 0 && stockActual <= Number(r.stock_minimo)
      return { ...r, alerta_inteligente: alertaPct || alertaMinimo, total_usado: totalUsado }
    })

    setStockData(stockConAlerta)
    setMovimientosData(movimientos ?? [])
    setLoading(false)
  }

  const lista = stockData.filter((r: any) => r.activo)
  const alertas = lista.filter((r: any) => r.alerta_inteligente).length
  const totalProductos = lista.length

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Resumen de stock y movimientos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{totalProductos}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
        </div>
        <div className={`card p-5 ${alertas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Alertas</div>
          <div className={`text-2xl font-bold ${alertas > 0 ? 'text-red-600' : 'text-campo-900'}`}>{alertas}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo el 10% de uso histórico</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock actual */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Stock Actual</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-campo-400">No hay productos registrados</td></tr>
                )}
                {lista
                  .sort((a: any, b: any) => (b.alerta_inteligente ? 1 : 0) - (a.alerta_inteligente ? 1 : 0))
                  .map((r: any, i: number) => (
                  <tr key={i} className={`border-b border-campo-50 hover:bg-campo-50/50 transition-colors ${r.alerta_inteligente ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-campo-900">{r.producto}</div>
                      <div className="text-xs text-campo-400">{r.marca}</div>
                    </td>
                    <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                    <td className="px-5 py-3 text-right font-medium text-campo-900">
                      {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {r.alerta_inteligente ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ Bajo</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos movimientos */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Últimos Movimientos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Fecha</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {movimientosData.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-campo-400">No hay movimientos registrados</td></tr>
                )}
                {movimientosData.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 text-campo-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td className="px-5 py-3 font-medium text-campo-900">{m.agroquimicos_productos?.nombre ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.tipo === 'compra'     ? 'bg-blue-100 text-blue-700' :
                        m.tipo === 'aplicacion' ? 'bg-orange-100 text-orange-700' :
                        m.tipo === 'devolucion' ? 'bg-purple-100 text-purple-700' :
                                                  'bg-campo-100 text-campo-600'
                      }`}>
                        {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-campo-900">
                      {Number(m.cantidad).toLocaleString('es-AR', { minimumFractionDigits: 1 })}
                      <span className="text-xs text-campo-400 ml-1">{m.agroquimicos_productos?.unidad}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
