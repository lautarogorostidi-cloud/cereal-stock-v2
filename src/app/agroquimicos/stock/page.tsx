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
  activo: boolean
  costo_promedio: number   // USD/unidad, promedio ponderado de compras
  valor_stock: number      // stock_actual * costo_promedio
}

type DescuentoDesparejo = { aplicacion_id: number; ciclo_id: number; fecha: string; producto: string; esperado: number; descontado: number; diferencia: number }

export default function StockAgroquimicosPage() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockItem[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [desparejos, setDesparejos] = useState<DescuentoDesparejo[]>([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)

    const [
      { data: stockData, error: errStock },
      { data: comprasData, error: errCompras },
      { data: desp, error: errDesp },
    ] = await Promise.all([
      supabase.from('vw_stock_agroquimicos').select('*').order('tipo').order('producto'),
      supabase.from('agroquimicos_movimientos')
        .select('producto_id, cantidad, precio_unitario')
        .eq('tipo', 'compra')
        .not('precio_unitario', 'is', null),
      supabase.from('vw_control_descuento_agroquimicos').select('*').order('fecha', { ascending: false }),
    ])
    setDesparejos((desp ?? []) as DescuentoDesparejo[])

    // Si alguna lectura falla (por ejemplo por permisos de la base) no se muestra
    // un stock vacío como si fuera real: se avisa con un cartel rojo.
    const fallo = errStock ?? errCompras ?? errDesp
    setErrorCarga(fallo ? fallo.message : null)

    // Costo promedio ponderado de compra por producto (USD/unidad)
    const acumPorProducto: Record<number, { totalUsd: number; totalCantidad: number }> = {}
    ;(comprasData ?? []).forEach((c: any) => {
      const cantidad = Number(c.cantidad ?? 0)
      const precio = Number(c.precio_unitario ?? 0)
      if (cantidad <= 0 || precio <= 0) return
      if (!acumPorProducto[c.producto_id]) acumPorProducto[c.producto_id] = { totalUsd: 0, totalCantidad: 0 }
      acumPorProducto[c.producto_id].totalUsd += cantidad * precio
      acumPorProducto[c.producto_id].totalCantidad += cantidad
    })

    const lista: StockItem[] = (stockData ?? [])
      .filter((r: any) => r.activo)
      .map((r: any) => {
        const stockActual = Number(r.stock_actual ?? 0)
        const acum = acumPorProducto[r.producto_id]
        const costoPromedio = acum && acum.totalCantidad > 0 ? acum.totalUsd / acum.totalCantidad : 0
        return {
          producto_id: r.producto_id,
          producto: r.producto,
          marca: r.marca,
          tipo: r.tipo,
          unidad: r.unidad,
          stock_actual: stockActual,
          activo: r.activo,
          costo_promedio: costoPromedio,
          valor_stock: stockActual * costoPromedio,
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
      (r.marca?.toLowerCase().includes(q) ?? false)
    )
  })

  const costoInventario = stock.reduce((s, r) => s + r.valor_stock, 0)
  const productosSinStock = stock.filter(r => r.stock_actual <= 0).length

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Agroquímicos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Stock actual y valor de inventario por producto</p>
        </div>
      </div>

      {/* Control: aplicaciones cuyo descuento de stock no coincide con dosis/ha × superficie */}
      {errorCarga && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <b>No se pudo leer el stock completo.</b> Los números de abajo pueden estar incompletos. Detalle: {errorCarga}
        </div>
      )}

      {desparejos.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold mb-1">
            ⚠ {desparejos.length} descuento{desparejos.length > 1 ? 's' : ''} de aplicación no coincide{desparejos.length > 1 ? 'n' : ''} con lo aplicado (dosis/ha × superficie). El stock puede estar mal.
          </div>
          <ul className="space-y-0.5">
            {desparejos.slice(0, 15).map(d => (
              <li key={`${d.aplicacion_id}-${d.producto}`}>
                {d.fecha.split('-').reverse().join('/')} · {d.producto}: descontado {fmt(Number(d.descontado))}, debería ser {fmt(Number(d.esperado))}.{' '}
                <a href={`/seguimiento/lotes/${d.ciclo_id}/aplicaciones/${d.aplicacion_id}/editar`} target="_blank" className="underline font-medium">Abrir aplicación y guardarla para recalcular</a>
              </li>
            ))}
            {desparejos.length > 15 && <li>…y {desparejos.length - 15} más.</li>}
          </ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{stock.length}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo inventario</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(costoInventario)}</div>
          <div className="text-xs text-campo-400 mt-0.5">valor del stock actual</div>
        </div>
        <div className={`card p-5 ${productosSinStock > 0 ? 'border-amber-200 bg-amber-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Sin stock</div>
          <div className={`text-2xl font-bold ${productosSinStock > 0 ? 'text-amber-600' : 'text-campo-900'}`}>{productosSinStock}</div>
          <div className="text-xs text-campo-400 mt-0.5">productos en 0</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto, tipo, marca..."
          className="flex-1 rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
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
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && listaFiltrada.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-campo-400">No hay productos</td></tr>
              )}
              {!loading && listaFiltrada.map((r, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-campo-900">{r.producto}</div>
                    {r.marca && <div className="text-xs text-campo-400">{r.marca}</div>}
                  </td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                  <td className="px-5 py-3 text-right font-semibold text-campo-900">
                    {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.costo_promedio > 0 ? (
                      <>
                        <div className="font-medium text-campo-900">{fmtUsd(r.valor_stock)}</div>
                        <div className="text-xs text-campo-400">{r.costo_promedio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD/{r.unidad}</div>
                      </>
                    ) : (
                      <span className="text-campo-300">—</span>
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
