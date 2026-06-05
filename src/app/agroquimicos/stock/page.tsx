import { createClient } from '@/lib/supabase/server'

export default async function StockAgroquimicosPage() {
  const supabase = createClient()
  const { data: stock } = await supabase
    .from('vw_stock_agroquimicos')
    .select('*')
    .order('tipo')
    .order('producto')

  const lista = (stock ?? []).filter((r: any) => r.activo)

  const fmt = (n: number | null | undefined) => {
    const num = Number(n ?? 0)
    return isNaN(num) ? '0,0' : num.toLocaleString('es-AR', { minimumFractionDigits: 1 })
  }

  const totalProductos = lista.length
  const alertas = lista.filter((r: any) => r.alerta_stock_minimo && r.stock_minimo > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Agroquímicos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición actual por producto</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos</div>
          <div className="text-2xl font-bold text-campo-900">{totalProductos}</div>
          <div className="text-xs text-campo-400 mt-0.5">en stock</div>
        </div>
        <div className={`card p-5 ${alertas > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Alertas</div>
          <div className={`text-2xl font-bold ${alertas > 0 ? 'text-red-600' : 'text-campo-900'}`}>{alertas}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo mínimo</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total Ingresado</div>
          <div className="text-2xl font-bold text-campo-900">
            {fmt(lista.reduce((acc: number, r: any) => acc + Number(r.total_ingresado ?? 0), 0))}
          </div>
          <div className="text-xs text-campo-400 mt-0.5">unidades compradas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total Aplicado</div>
          <div className="text-2xl font-bold text-campo-900">
            {fmt(lista.reduce((acc: number, r: any) => acc + Number(r.total_aplicado ?? 0), 0))}
          </div>
          <div className="text-xs text-campo-400 mt-0.5">unidades en campo</div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Marca</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ingresado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Aplicado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Actual</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Mínimo</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r: any, i: number) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{r.producto}</td>
                  <td className="px-5 py-3 text-campo-500 text-xs">{r.marca ?? '—'}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{r.tipo}</td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {fmt(r.total_ingresado)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-orange-600">
                    {fmt(r.total_aplicado)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-campo-900">
                    {fmt(r.stock_actual)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-campo-500">
                    {fmt(r.stock_minimo)} <span className="text-xs text-campo-400">{r.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    {r.alerta_stock_minimo && r.stock_minimo > 0 ? (
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
              {lista.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-campo-400">
                    No hay stock registrado todavía
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
