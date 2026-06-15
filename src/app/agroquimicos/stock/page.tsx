'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StockItem = {
  producto_id: number
  producto: string
  marca: string | null
  tipo: string
  unidad: string
  stock_actual: number
  total_usado_historico: number
  activo: boolean
  // Alerta predictiva
  alerta: boolean
  alerta_tipo: 'predictiva' | 'stock_bajo' | null
  mes_proximo: string | null       // nombre del mes próximo de uso
  cantidad_necesaria: number       // promedio histórico para ese mes
  diferencia: number               // stock_actual - cantidad_necesaria
}

const MESES_NOMBRES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default function StockAgroquimicosPage() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockItem[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const [
      { data: stockData },
      { data: usadoData },
      { data: historialData },
    ] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('*').order('tipo').order('producto'),
      // Uso total histórico por producto
      supabase.from('sa_aplicacion_productos').select('producto, dosis_ha, sa_aplicaciones(superficie_ha)'),
      // Historial mensual: cuánto se usó por producto por mes (para el sistema predictivo)
      supabase.from('sa_aplicacion_productos').select('producto, dosis_ha, sa_aplicaciones!inner(fecha, superficie_ha)'),
    ])

    // ── Uso total histórico por producto ──
    const usadoMap: Record<string, number> = {}
    ;(usadoData ?? []).forEach((ap: any) => {
      const nombre = ap.producto?.trim().toLowerCase()
      const superficie = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      if (nombre) usadoMap[nombre] = (usadoMap[nombre] ?? 0) + dosis * superficie
    })

    // Top 20 productos más usados
    const top20 = new Set(
      Object.entries(usadoMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([nombre]) => nombre)
    )

    // ── Historial mensual por producto ──
    // Para cada producto y mes (1-12), acumular cantidad usada y contar campañas
    // usoPorMes[producto][mes] = { total, campanas: Set }
    const usoPorMes: Record<string, Record<number, { total: number; campanas: Set<string> }>> = {}
    ;(historialData ?? []).forEach((ap: any) => {
      const fecha = ap.sa_aplicaciones?.fecha
      if (!fecha) return
      const nombre = ap.producto?.trim().toLowerCase()
      if (!nombre) return
      const d = new Date(fecha + 'T00:00:00')
      const mes = d.getMonth() + 1 // 1-12
      const anio = d.getFullYear()
      const superficie = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      const cantidad = dosis * superficie

      if (!usoPorMes[nombre]) usoPorMes[nombre] = {}
      if (!usoPorMes[nombre][mes]) usoPorMes[nombre][mes] = { total: 0, campanas: new Set() }
      usoPorMes[nombre][mes].total += cantidad
      usoPorMes[nombre][mes].campanas.add(String(anio))
    })

    // Mes actual y próximo mes (para detectar si falta ~1 mes)
    const hoy = new Date()
    const mesActual = hoy.getMonth() + 1 // 1-12
    const mesProximo = mesActual === 12 ? 1 : mesActual + 1

    const lista: StockItem[] = (stockData ?? [])
      .filter((r: any) => r.activo)
      .map((r: any) => {
        const stockActual = Number(r.stock_actual ?? 0)
        const nombreNorm = r.producto?.trim().toLowerCase()
        const totalUsado = usadoMap[nombreNorm] ?? 0
        const enTop20 = top20.has(nombreNorm)

        // ── Alerta predictiva ──
        let alerta = false
        let alerta_tipo: StockItem['alerta_tipo'] = null
        let mes_proximo: string | null = null
        let cantidad_necesaria = 0
        let diferencia = 0

        if (enTop20) {
          const histMes = usoPorMes[nombreNorm] ?? {}

          // Ver si el próximo mes tiene uso histórico
          const dataMesProximo = histMes[mesProximo]
          if (dataMesProximo && dataMesProximo.total > 0) {
            const nCampanas = dataMesProximo.campanas.size || 1
            const promedio = dataMesProximo.total / nCampanas
            cantidad_necesaria = promedio
            diferencia = stockActual - promedio

            if (stockActual < promedio) {
              alerta = true
              alerta_tipo = 'predictiva'
              mes_proximo = MESES_NOMBRES[mesProximo - 1]
            }
          }

          // Si no hay alerta predictiva, verificar stock muy bajo vs histórico total
          if (!alerta && totalUsado > 0 && stockActual < totalUsado * 0.1) {
            alerta = true
            alerta_tipo = 'stock_bajo'
          }
        }

        return {
          producto_id: r.producto_id,
          producto: r.producto,
          marca: r.marca,
          tipo: r.tipo,
          unidad: r.unidad,
          stock_actual: stockActual,
          total_usado_historico: totalUsado,
          activo: r.activo,
          alerta,
          alerta_tipo,
          mes_proximo,
          cantidad_necesaria,
          diferencia,
        }
      })

    setStock(lista)
    setLoading(false)
  }

  const listaFiltrada = stock
    .filter(r => {
      if (soloAlertas && !r.alerta) return false
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        r.producto.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        (r.marca?.toLowerCase().includes(q) ?? false)
      )
    })
    .sort((a, b) => {
      // Primero alertas predictivas, luego stock bajo, luego el resto
      const orden = (x: StockItem) => x.alerta_tipo === 'predictiva' ? 0 : x.alerta_tipo === 'stock_bajo' ? 1 : 2
      return orden(a) - orden(b)
    })

  const alertasPredictivas = stock.filter(r => r.alerta_tipo === 'predictiva').length
  const alertasStockBajo = stock.filter(r => r.alerta_tipo === 'stock_bajo').length
  const totalAlertas = stock.filter(r => r.alerta).length

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Agroquímicos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Alertas predictivas — top 20 productos por uso histórico</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{stock.length}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
        </div>
        <div className={`card p-5 ${totalAlertas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total alertas</div>
          <div className={`text-2xl font-bold ${totalAlertas > 0 ? 'text-red-600' : 'text-campo-900'}`}>{totalAlertas}</div>
          <div className="text-xs text-campo-400 mt-0.5">top 20 productos</div>
        </div>
        <div className={`card p-5 ${alertasPredictivas > 0 ? 'border-orange-200 bg-orange-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Alertas predictivas</div>
          <div className={`text-2xl font-bold ${alertasPredictivas > 0 ? 'text-orange-600' : 'text-campo-900'}`}>{alertasPredictivas}</div>
          <div className="text-xs text-campo-400 mt-0.5">stock insuf. para próximo mes</div>
        </div>
        <div className={`card p-5 ${alertasStockBajo > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Stock crítico</div>
          <div className={`text-2xl font-bold ${alertasStockBajo > 0 ? 'text-red-600' : 'text-campo-900'}`}>{alertasStockBajo}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo 10% del histórico</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, tipo, marca..."
          className="flex-1 rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        <button onClick={() => setSoloAlertas(!soloAlertas)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${soloAlertas ? 'bg-red-600 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
          {soloAlertas ? '⚠️ Solo alertas' : 'Todos'}
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock actual</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Necesario (próx. mes)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Diferencia</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && listaFiltrada.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-campo-400">No hay productos</td></tr>
              )}
              {!loading && listaFiltrada.map((r, i) => (
                <tr key={i} className={`border-b border-campo-50 hover:bg-campo-50/50 transition-colors ${r.alerta_tipo === 'predictiva' ? 'bg-orange-50/40' : r.alerta_tipo === 'stock_bajo' ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium text-campo-900">{r.producto}</div>
                    {r.marca && <div className="text-xs text-campo-400">{r.marca}</div>}
                  </td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                  <td className="px-5 py-3 text-right font-semibold text-campo-900">
                    {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-campo-600">
                    {r.cantidad_necesaria > 0
                      ? <>{fmt(r.cantidad_necesaria)} <span className="text-xs text-campo-400">{r.unidad} en {r.mes_proximo ?? 'próx. mes'}</span></>
                      : <span className="text-campo-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.cantidad_necesaria > 0 ? (
                      <span className={`font-medium ${r.diferencia < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {r.diferencia >= 0 ? '+' : ''}{fmt(r.diferencia)} <span className="text-xs">{r.unidad}</span>
                      </span>
                    ) : <span className="text-campo-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {r.alerta_tipo === 'predictiva' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        🔔 Comprar antes de {r.mes_proximo}
                      </span>
                    ) : r.alerta_tipo === 'stock_bajo' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        ⚠️ Stock crítico
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        ✓ OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
