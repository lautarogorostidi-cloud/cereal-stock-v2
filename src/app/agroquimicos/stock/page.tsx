'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StockItem = {
  producto_id: number
  producto: string
  marca: string | null
  tipo: string
  unidad: string
  stock_minimo: number
  stock_actual: number
  total_usado_historico: number
  alerta: boolean
  activo: boolean
}

export default function StockAgroquimicosPage() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockItem[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    setLoading(true)

    // Stock actual desde la vista
    const { data: stockData } = await supabase
      .from('vw_stock_agroquimicos')
      .select('*')
      .order('tipo')
      .order('producto')

    // Total usado histórico por producto (desde aplicaciones en seguimiento)
    const { data: usadoData } = await supabase
      .from('sa_aplicacion_productos')
      .select('producto, dosis_ha, sa_aplicaciones(superficie_ha)')

    // Calcular total usado por nombre de producto
    const usadoMap: Record<string, number> = {}
    ;(usadoData ?? []).forEach((ap: any) => {
      const nombre = ap.producto?.trim().toLowerCase()
      const superficie = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      if (nombre) {
        usadoMap[nombre] = (usadoMap[nombre] ?? 0) + dosis * superficie
      }
    })

    const lista: StockItem[] = (stockData ?? [])
      .filter((r: any) => r.activo)
      .map((r: any) => {
        const stockActual = Number(r.stock_actual ?? 0)
        const nombreNorm = r.producto?.trim().toLowerCase()
        const totalUsado = usadoMap[nombreNorm] ?? 0
        // Alerta si stock actual < 10% del total histórico usado, o si está bajo el mínimo definido
        const alertaPct = totalUsado > 0 && stockActual < totalUsado * 0.1
        const alertaMinimo = r.stock_minimo > 0 && stockActual <= Number(r.stock_minimo)
        return {
          producto_id: r.producto_id,
          producto: r.producto,
          marca: r.marca,
          tipo: r.tipo,
          unidad: r.unidad,
          stock_minimo: Number(r.stock_minimo ?? 0),
          stock_actual: stockActual,
          total_usado_historico: totalUsado,
          alerta: alertaPct || alertaMinimo,
          activo: r.activo,
        }
      })

    setStock(lista)
    setLoading(false)
  }

  const listaFiltrada = stock.filter(r => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      r.producto.toLowerCase().includes(q) ||
      r.tipo.toLowerCase().includes(q) ||
      r.marca?.toLowerCase().includes(q)
    )
  })

  const alertas = listaFiltrada.filter(r => r.alerta).length
  const totalProductos = listaFiltrada.length

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  // Porcentaje de stock restante vs histórico usado
  const getPct = (item: StockItem) => {
    if (item.total_usado_historico <= 0) return null
    return Math.round((item.stock_actual / item.total_usado_historico) * 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Agroquímicos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición actual — alerta al 10% del uso histórico</p>
        </div>
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

      {/* Buscador */}
      <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar producto, tipo, marca..."
        className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Marca</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Actual</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Uso histórico</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">% restante</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && listaFiltrada.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay stock registrado</td></tr>
              )}
              {!loading && listaFiltrada
                .sort((a, b) => (b.alerta ? 1 : 0) - (a.alerta ? 1 : 0))
                .map((r, i) => {
                  const pct = getPct(r)
                  return (
                    <tr key={i} className={`border-b border-campo-50 hover:bg-campo-50/50 transition-colors ${r.alerta ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3 font-medium text-campo-900">{r.producto}</td>
                      <td className="px-5 py-3 text-campo-500 text-xs">{r.marca ?? '—'}</td>
                      <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                      <td className="px-5 py-3 text-right font-semibold text-campo-900">
                        {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-campo-500">
                        {r.total_usado_historico > 0 ? <>{fmt(r.total_usado_historico)} <span className="text-xs text-campo-400">{r.unidad}</span></> : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {pct !== null ? (
                          <span className={`font-medium ${pct <= 10 ? 'text-red-600' : pct <= 25 ? 'text-orange-500' : 'text-emerald-600'}`}>
                            {pct}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.alerta ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ Bajo</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
