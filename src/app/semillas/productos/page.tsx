import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProductosSemillasPage() {
  const supabase = createClient()
  const { data: productos } = await supabase
    .from('semillas_productos')
    .select('*, cultivos(nombre), proveedores(nombre)')
    .order('nombre')

  const lista = productos ?? []

  const porCultivo = lista.reduce((acc: Record<string, typeof lista>, p: any) => {
    const c = p.cultivos?.nombre ?? 'Sin cultivo'
    if (!acc[c]) acc[c] = []
    acc[c].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Productos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Catálogo de semillas — {lista.length} productos</p>
        </div>
        <a href="/semillas/movimientos" className="btn-primary">+ Agregar producto</a>
      </div>

      {Object.entries(porCultivo).map(([cultivo, prods]) => (
        <div key={cultivo} className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">
              🌱 {cultivo} — {prods.length} producto{prods.length === 1 ? '' : 's'}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Marca</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Proveedor</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Unidad</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Semillas/bolsa</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Kg/bolsa</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock mínimo</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {prods.map((p: any) => (
                  <tr key={p.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-campo-900">{p.nombre}</td>
                    <td className="px-5 py-3 text-campo-600">{p.marca ?? '—'}</td>
                    <td className="px-5 py-3 text-campo-600">{p.proveedores?.nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-campo-100 text-campo-700">
                        {p.unidad}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-campo-600">{p.semillas_por_bolsa ? Number(p.semillas_por_bolsa).toLocaleString('es-AR') : '—'}</td>
                    <td className="px-5 py-3 text-right text-campo-600">{p.kg_por_bolsa ? `${Number(p.kg_por_bolsa).toLocaleString('es-AR')} kg` : '—'}</td>
                    <td className="px-5 py-3 text-right text-campo-600">{Number(p.stock_minimo) > 0 ? Number(p.stock_minimo).toLocaleString('es-AR') : '—'}</td>
                    <td className="px-5 py-3 text-center">
                      {p.activo ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          ✓ Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-campo-100 text-campo-500">
                          Inactivo
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

      {lista.length === 0 && (
        <div className="card p-12 text-center text-campo-400">
          No hay productos registrados todavía. Se agregan desde la pantalla de Movimientos.
        </div>
      )}
    </div>
  )
}
