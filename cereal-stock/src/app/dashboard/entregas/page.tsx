import { createClient } from '@/lib/supabase/server'

export default async function EntregasPage() {
  const supabase = createClient()
  const { data: entregas } = await supabase
    .from('movimientos_cereal')
    .select(`*, campanias(nombre), cultivos(nombre), clientes(razon_social), contratos(numero)`)
    .eq('tipo', 'entrega')
    .order('fecha', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Entregas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Historial de entregas realizadas</p>
        </div>
        <a href="/dashboard/entregas/nueva" className="btn-primary">+ Nueva entrega</a>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Humedad</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {entregas?.map(e => (
                <tr key={e.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                  <td className="px-4 py-3 text-campo-600">{new Date(e.fecha).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{(e.cultivos as any)?.nombre}</td>
                  <td className="px-4 py-3 text-campo-600">{(e.campanias as any)?.nombre}</td>
                  <td className="px-4 py-3 text-right font-medium">{Number(e.toneladas).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-right text-campo-500">{e.humedad ? `${e.humedad}%` : '—'}</td>
                  <td className="px-4 py-3 text-campo-700">{(e.clientes as any)?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{(e.contratos as any)?.numero ?? '—'}</td>
                </tr>
              ))}
              {(!entregas || entregas.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-campo-400">Sin entregas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
