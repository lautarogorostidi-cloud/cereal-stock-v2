'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StockItem = {
  producto_id: number
  producto: string
  marca: string | null
  cultivo: string
  unidad: string
  stock_minimo: number
  proveedor_default: string | null
  total_ingresado: number
  stock_actual: number
  alerta_stock_minimo: boolean
  activo: boolean
}

type CompraMov = { campania: string | null; cantidad: number; precio_unitario: number | null; semillas_productos: { cultivos: { nombre: string } | null } | null }
type Campana = { id: number; nombre: string }

export default function StockSemillasPage() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockItem[]>([])
  const [compras, setCompras] = useState<CompraMov[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [campaniaKpi, setCampaniaKpi] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloAlertas, setSoloAlertas] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data }, { data: comprasData }, { data: caps }] = await Promise.all([
      supabase.from('vw_stock_semillas').select('*').order('cultivo').order('producto'),
      supabase.from('semillas_movimientos').select('campania, cantidad, precio_unitario, semillas_productos(cultivos(nombre))').eq('tipo', 'compra'),
      supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
    ])
    setStock(((data ?? []) as StockItem[]).filter(r => r.activo))
    setCompras((comprasData ?? []) as any)
    setCampanas(caps ?? [])
    setLoading(false)
  }

  const listaFiltrada = stock.filter(r => {
    if (soloAlertas && !r.alerta_stock_minimo) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      r.producto.toLowerCase().includes(q) ||
      r.cultivo.toLowerCase().includes(q) ||
      (r.marca?.toLowerCase().includes(q) ?? false)
    )
  })

  const porCultivo = listaFiltrada.reduce((acc: Record<string, StockItem[]>, r) => {
    if (!acc[r.cultivo]) acc[r.cultivo] = []
    acc[r.cultivo].push(r)
    return acc
  }, {})

  const comprasCampania = campaniaKpi ? compras.filter(c => c.campania === campaniaKpi) : compras
  const costoTotalCampania = comprasCampania.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario ?? 0), 0)

  const costoPorCultivo = Object.entries(
    comprasCampania.reduce((acc: Record<string, number>, c) => {
      const cultivo = c.semillas_productos?.cultivos?.nombre ?? 'Sin cultivo'
      acc[cultivo] = (acc[cultivo] ?? 0) + Number(c.cantidad) * Number(c.precio_unitario ?? 0)
      return acc
    }, {})
  ).sort(([, a], [, b]) => b - a)

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtUsd = (n: number) => `USD ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Semillas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Maíz, Girasol y demás semillas — compras y stock disponible</p>
        </div>
        <a href="/semillas/movimientos" className="btn-primary">+ Nuevo movimiento</a>
      </div>

      {/* Selector de campaña */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-campo-700">Campaña</label>
        <select value={campaniaKpi} onChange={e => setCampaniaKpi(e.target.value)}
          className="rounded-lg border border-campo-300 bg-white px-4 py-2.5 text-base font-medium text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[160px]">
          <option value="">Todas las campañas</option>
          {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
      </div>

      {/* KPIs de costo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <div className="text-sm font-semibold text-campo-500 uppercase tracking-wider mb-2">Costo total</div>
          <div className="text-4xl font-bold text-campo-900">{fmtUsd(costoTotalCampania)}</div>
          <div className="text-sm text-campo-400 mt-1">compras de semilla{campaniaKpi ? ` — campaña ${campaniaKpi}` : ' — todas las campañas'}</div>
        </div>
        <div className="card p-6">
          <div className="text-sm font-semibold text-campo-500 uppercase tracking-wider mb-3">Costo por cultivo</div>
          {costoPorCultivo.length === 0 ? (
            <div className="text-base text-campo-400">Sin compras registradas{campaniaKpi ? ` en ${campaniaKpi}` : ''}.</div>
          ) : (
            <div className="space-y-2.5">
              {costoPorCultivo.map(([cultivo, monto]) => (
                <div key={cultivo} className="flex items-center justify-between text-base">
                  <span className="text-campo-700 font-medium">🌱 {cultivo}</span>
                  <span className="font-bold text-lg text-campo-900">{fmtUsd(monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, cultivo, marca..."
          className="flex-1 rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        <button onClick={() => setSoloAlertas(!soloAlertas)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${soloAlertas ? 'bg-red-600 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
          {soloAlertas ? '⚠️ Solo alertas' : 'Todos'}
        </button>
      </div>

      {loading && <div className="card p-10 text-center text-campo-400">Cargando...</div>}

      {!loading && Object.keys(porCultivo).length === 0 && (
        <div className="card p-12 text-center text-campo-400">
          No hay semillas cargadas todavía. Empezá agregando un movimiento de compra.
        </div>
      )}

      {!loading && Object.entries(porCultivo).map(([cultivo, items]) => (
        <div key={cultivo} className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">🌱 {cultivo} — {items.length} producto{items.length === 1 ? '' : 's'}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Proveedor</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock actual</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Comprado</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.producto_id} className={`border-b border-campo-50 hover:bg-campo-50/50 transition-colors ${r.alerta_stock_minimo ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-campo-900">{r.producto}</div>
                      {r.marca && <div className="text-xs text-campo-400">{r.marca}</div>}
                    </td>
                    <td className="px-5 py-3 text-campo-600">{r.proveedor_default ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-campo-900">
                      {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-campo-600">{fmt(r.total_ingresado)}</td>
                    <td className="px-5 py-3 text-center">
                      {r.alerta_stock_minimo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          ⚠️ Stock bajo
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
      ))}
    </div>
  )
}
