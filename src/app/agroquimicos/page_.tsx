import { createClient } from '@/lib/supabase/server'

export default async function AgroquimicosDashboard() {
  const supabase = createClient()

  const [{ data: stock }, { data: movimientos }] = await Promise.all([
    supabase.from('vw_stock_agroquimicos').select('*'),
    supabase.from('agroquimicos_movimientos')
      .select('*, agroquimicos_productos(nombre, unidad)')
      .order('fecha', { ascending: false })
      .limit(5),
  ])

  const stockData = stock ?? []
  const movimientosData = movimientos ?? []

  // KPIs
  const totalProductos = stockData.length
  const alertas = stockData.filter((r: any) => r.alerta_stock_minimo).length
  const totalCompras = stockData.reduce((acc: number, r: any) => acc + Number(r.total_ingresado ?? 0), 0)
  const totalAplicado = stockData.reduce((acc: number, r: any) => acc + Number(r.total_aplicado ?? 0), 0)

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1 })

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Resumen de stock y movimientos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{totalProductos}</div>
          <div className="text-xs text-campo-400 mt-0.5">en catálogo</div>
        </div>
        <div className={`card p-5 ${alertas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Alertas</div>
          <div className={`text-2xl font-bold ${alertas > 0 ? 'text-red-600' : 'text-campo-900'}`}>{alertas}</div>
          <div className="text-xs text-campo-400 mt-0.5">stock bajo mínimo</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total Ingresado</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalCompras)}</div>
          <div className="text-xs text-campo-400 mt-0.5">unidades compradas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total Aplicado</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalAplicado)}</div>
          <div className="text-xs text-campo-400 mt-0.5">unidades en campo</div>
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
                {stockData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-campo-400">
                      No hay productos registrados todavía
                    </td>
                  </tr>
                )}
                {stockData.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-campo-900">{r.producto}</div>
                      <div className="text-xs text-campo-400">{r.marca}</div>
                    </td>
                    <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                    <td className="px-5 py-3 text-right font-medium text-campo-900">
                      {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {r.alerta_stock_minimo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          ⚠️ Bajo
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
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-campo-400">
                      No hay movimientos registrados todavía
                    </td>
                  </tr>
                )}
                {movimientosData.map((m: any, i: number) => (
                  <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 text-campo-600">
                      {new Date(m.fecha).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-5 py-3 font-medium text-campo-900">
                      {m.agroquimicos_productos?.nombre ?? '—'}
                    </td>
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
                      <span className="text-xs text-campo-400 ml-1">
                        {m.agroquimicos_productos?.unidad}
                      </span>
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
