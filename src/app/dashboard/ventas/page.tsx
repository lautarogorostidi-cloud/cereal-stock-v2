import { createClient } from '@/lib/supabase/server'

const tipoColor: Record<string, string> = {
  cosecha:       'badge-verde',
  venta:         'badge-trigo',
  entrega:       'badge-azul',
  transferencia: 'badge-gris',
  ajuste:        'badge-gris',
  devolucion:    'badge-rojo',
}

export default async function VentasPage() {
  const supabase = createClient()
  const { data: movimientos } = await supabase
    .from('movimientos_cereal')
    .select(`
      *,
      campanias(nombre),
      cultivos(nombre, codigo),
      clientes(razon_social),
      monedas(codigo, simbolo)
    `)
    .order('fecha', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Todos los movimientos de cereal registrados</p>
        </div>
        <a href="/dashboard/ventas/nuevo" className="btn-primary">
          + Nuevo movimiento
        </a>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Humedad</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {movimientos?.map(m => (
                <tr key={m.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{new Date(m.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <span className={tipoColor[m.tipo] ?? 'badge-gris'}>{m.tipo}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-campo-900">
                    {(m.cultivos as any)?.nombre ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-campo-600">{(m.campanias as any)?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(m.toneladas).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-right text-campo-500">{m.humedad ? `${m.humedad}%` : '—'}</td>
                  <td className="px-4 py-3 text-campo-700">{(m.clientes as any)?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-campo-700">
                    {m.precio_unitario
                      ? `${(m.monedas as any)?.simbolo ?? ''} ${Number(m.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.resultado_neto
                      ? <span className={Number(m.resultado_neto) >= 0 ? 'text-campo-600 font-medium' : 'text-red-500 font-medium'}>
                          {Number(m.resultado_neto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      : '—'}
                  </td>
                </tr>
              ))}
              {(!movimientos || movimientos.length === 0) && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-campo-400">
                    No hay movimientos registrados
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
