import { createClient } from '@/lib/supabase/server'

export default async function SeguimientoDashboard() {
  const supabase = createClient()

  const [{ data: ciclos }, { data: campanas }] = await Promise.all([
    supabase.from('vw_sa_resumen_ciclo').select('*'),
    supabase.from('campanas').select('*').order('nombre', { ascending: false }),
  ])

  const lista = ciclos ?? []
  const campanaActual = (campanas ?? [])[0]?.nombre ?? ''
  const ciclosCampana = lista.filter((r: any) => r.campana === campanaActual)

  const fmt = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const fmtUsd = (n: number) => `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  // KPIs campaña actual
  const totalHa = ciclosCampana.reduce((acc: number, r: any) => acc + Number(r.sup_sembrada ?? r.hectareas ?? 0), 0)
  const totalLotes = ciclosCampana.length
  const totalKg = ciclosCampana.reduce((acc: number, r: any) => acc + Number(r.rinde_kg_total ?? 0), 0)
  const costoTotal = ciclosCampana.reduce((acc: number, r: any) =>
    acc + Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
    Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) +
    Number(r.costo_fijos_usd ?? 0), 0)

  // Agrupar por cultivo
  const porCultivo = ciclosCampana.reduce((acc: Record<string, any>, r: any) => {
    if (!acc[r.cultivo]) acc[r.cultivo] = { lotes: 0, ha: 0, kg: 0 }
    acc[r.cultivo].lotes++
    acc[r.cultivo].ha += Number(r.sup_sembrada ?? r.hectareas ?? 0)
    acc[r.cultivo].kg += Number(r.rinde_kg_total ?? 0)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Seguimiento Agronómico</h1>
        <p className="text-campo-500 text-sm mt-0.5">Campaña actual: {campanaActual}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Lotes</div>
          <div className="text-2xl font-bold text-campo-900">{totalLotes}</div>
          <div className="text-xs text-campo-400 mt-0.5">en campaña {campanaActual}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Superficie</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalHa)}</div>
          <div className="text-xs text-campo-400 mt-0.5">hectáreas sembradas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Producción</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalKg / 1000)}</div>
          <div className="text-xs text-campo-400 mt-0.5">toneladas cosechadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Total</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(costoTotal)}</div>
          <div className="text-xs text-campo-400 mt-0.5">implantación + fijos</div>
        </div>
      </div>

      {/* Resumen por cultivo */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100">
          <h2 className="font-semibold text-campo-900">Resumen por Cultivo — {campanaActual}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Lotes</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Hectáreas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Producción (kg)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde (kg/ha)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(porCultivo).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-campo-400">
                    No hay ciclos registrados para esta campaña
                  </td>
                </tr>
              )}
              {Object.entries(porCultivo).map(([cultivo, data]: [string, any]) => (
                <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{cultivo}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{data.lotes}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(data.ha)}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(data.kg)}</td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">
                    {data.ha > 0 ? fmt(data.kg / data.ha) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
          <h2 className="font-semibold text-campo-900">Lotes — {campanaActual}</h2>
          <a href="/seguimiento/lotes" className="text-sm text-lime-700 hover:text-lime-600 font-medium">
            Ver todos →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo USD</th>
              </tr>
            </thead>
            <tbody>
              {ciclosCampana.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-campo-400">
                    No hay ciclos registrados todavía
                  </td>
                </tr>
              )}
              {ciclosCampana.slice(0, 10).map((r: any, i: number) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{r.lote}</td>
                  <td className="px-5 py-3 text-campo-500 text-xs">{r.campo}</td>
                  <td className="px-5 py-3 text-campo-700">{r.cultivo}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.sup_sembrada ?? r.hectareas)}</td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">
                    {r.rinde_kg_ha ? fmt(r.rinde_kg_ha) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {fmtUsd(
                      Number(r.costo_semillas_usd ?? 0) +
                      Number(r.costo_insumos_usd ?? 0) +
                      Number(r.costo_fertilizantes_usd ?? 0) +
                      Number(r.costo_servicios_usd ?? 0) +
                      Number(r.costo_fijos_usd ?? 0)
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
