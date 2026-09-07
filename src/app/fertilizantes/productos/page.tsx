import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProductosFertilizantesPage() {
  const supabase = createClient()
  const { data: productos } = await supabase
    .from('fertilizantes_productos')
    .select('*, proveedores(nombre)')
    .order('nombre')

  const lista = productos ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Productos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Catálogo de fertilizantes — {lista.length} productos</p>
        </div>
        <a href="/fertilizantes/movimientos" className="btn-primary">+ Agregar producto</a>
      </div>

      {lista.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Marca</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Proveedor</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Unidad</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock mínimo</th>
                  <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p: any) => (
                  <tr key={p.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-campo-900">{p.nombre}</td>
                    <td className="px-5 py-3 text-campo-600">{p.marca ?? '—'}</td>
                    <td className="px-5 py-3 text-campo-600">{p.proveedores?.nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-campo-100 text-campo-700">
                        {p.unidad}
                      </span>
                    </td>
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
      )}

      {lista.length === 0 && (
        <div className="card p-12 text-center text-campo-400">
          No hay productos registrados todavía. Se agregan desde la pantalla de Movimientos.
        </div>
      )}
    </div>
  )
}
