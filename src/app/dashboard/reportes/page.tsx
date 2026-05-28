import { createClient } from '@/lib/supabase/server'

export default async function ReportesPage() {
  const supabase = createClient()
  const { data: resultados } = await supabase.from('vw_resultado_comercial').select('*')

  const totalBruto = resultados?.reduce((s, r) => s + Number(r.ingreso_bruto ?? 0), 0) ?? 0
  const totalGastos = resultados?.reduce((s, r) => s + Number(r.total_gastos ?? 0), 0) ?? 0
  const totalNeto = resultados?.reduce((s, r) => s + Number(r.resultado_neto ?? 0), 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes</h1>
        <p className="text-campo-500 text-sm mt-0.5">Resultado comercial por campaña y cultivo</p>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-2">Ingreso Bruto</div>
          <div className="text-xl font-bold text-campo-800">${totalBruto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-2">Total Gastos</div>
          <div className="text-xl font-bold text-red-600">-${totalGastos.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-2">Resultado Neto</div>
          <div className={`text-xl font-bold ${totalNeto >= 0 ? 'text-campo-600' : 'text-red-600'}`}>
            ${totalNeto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Tabla detallada */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100">
          <h2 className="font-semibold text-campo-800">Resultado por Cultivo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Operaciones</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Precio Prom.</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ingreso Bruto</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Gastos</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Neto</th>
              </tr>
            </thead>
            <tbody>
              {resultados?.map((r, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 text-campo-600">{r.campania}</td>
                  <td className="px-5 py-3 font-medium text-campo-900">{r.cultivo}</td>
                  <td className="px-5 py-3 text-right text-campo-600">{r.cantidad_operaciones}</td>
                  <td className="px-5 py-3 text-right">{Number(r.ton_totales).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {r.precio_promedio ? `${r.moneda} ${Number(r.precio_promedio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">${Number(r.ingreso_bruto ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                  <td className="px-5 py-3 text-right text-red-500">-${Number(r.total_gastos ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${Number(r.resultado_neto) >= 0 ? 'text-campo-600' : 'text-red-500'}`}>
                      ${Number(r.resultado_neto ?? 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </span>
                  </td>
                </tr>
              ))}
              {(!resultados || resultados.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-campo-400">
                    Sin datos de resultados todavía
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
