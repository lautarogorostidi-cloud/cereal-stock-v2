import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StockPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: comprometido }, { data: silos }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_comprometido').select('*'),
    supabase.from('vw_stock_silos').select('*'),
  ])

  const stockConComprometido = (stock ?? []).map(r => {
    const comp = (comprometido ?? []).find(
      c => c.campania === r.campania && c.cultivo === r.cultivo
    )
    const ton_comprometidas_real = Number(comp?.ton_comprometidas ?? 0)
    const stock_fisico = Number(r.ton_ingresadas ?? 0) - Number(r.ton_salidas ?? 0)
    const margen = stock_fisico - ton_comprometidas_real
    const stock_campo = Number(r.stock_campo ?? 0)
    const stock_acopio = Number(r.stock_acopio ?? 0)

    // Silos de esta fila (vw_stock_silos guarda el cultivo específico -Soja 1,
    // Maíz Temprano, etc.-, por eso se cruza por cultivo_comercial, no por cultivo)
    const silosRow = (silos ?? []).filter(
      s => s.campania === r.campania && s.cultivo_comercial === r.cultivo
    )
    const silosCampo = silosRow.filter(s => s.ubicacion === 'campo')
    const silosAcopio = silosRow.filter(s => s.ubicacion === 'acopio')

    // Un mismo acopio (Fedea, Morero, etc.) puede tener mercadería de varias
    // cargas/lotes distintos (cada uno es un registro de vw_stock_silos): acá
    // se suman todas las cargas de un mismo acopio en una sola línea, para
    // mostrar cuánto hay en total en cada acopio, no una línea por carga.
    const acopiosPorCliente = new Map<string, { nombre: string; total: number }>()
    for (const s of silosAcopio) {
      const key = s.acopio_cliente_id ?? s.acopio_nombre ?? 'acopio'
      const prev = acopiosPorCliente.get(key)
      const monto = Number(s.stock_actual)
      if (prev) prev.total += monto
      else acopiosPorCliente.set(key, { nombre: s.acopio_nombre ?? 'Acopio', total: monto })
    }
    const acopiosAgrupados = Array.from(acopiosPorCliente.values())

    return { ...r, ton_comprometidas_real, stock_fisico, margen, stock_campo, stock_acopio, silosCampo, silosAcopio, acopiosAgrupados }
  })

  const fmt = (n: number | null | undefined) => {
    const num = Number(n ?? 0)
    return isNaN(num) ? '0,0' : num.toLocaleString('es-AR', { minimumFractionDigits: 1 })
  }

  const totalCampo = stockConComprometido.reduce((s, r) => s + r.stock_campo, 0)
  const totalAcopio = stockConComprometido.reduce((s, r) => s + r.stock_acopio, 0)
  const totalFisico = stockConComprometido.reduce((s, r) => s + r.stock_fisico, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Cereal</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición física y disponible por cultivo</p>
        </div>
      </div>

      {/* Resumen de ubicación */}
      {(totalCampo > 0 || totalAcopio > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-1">En campo</p>
            <p className="text-2xl font-bold text-campo-900">{fmt(totalCampo)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Embolsado / silo propio</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">En acopio</p>
            <p className="text-2xl font-bold text-blue-700">{fmt(totalAcopio)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Almacenado en terceros</p>
          </div>
          <div className="card p-4 text-center border-2 border-campo-200">
            <p className="text-xs font-semibold text-campo-700 uppercase tracking-wide mb-1">Total físico</p>
            <p className="text-2xl font-bold text-campo-900">{fmt(totalFisico)} tn</p>
            <p className="text-xs text-campo-400 mt-0.5">Campo + Acopio</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ingreso</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Físico</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">En campo / silos</th>
                <th className="text-left px-5 py-3 font-semibold text-blue-600">En acopio</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Entregado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Comprometido</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Margen</th>
              </tr>
            </thead>
            <tbody>
              {stockConComprometido.map((r, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 text-campo-600">{r.campania}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-campo-900">{r.cultivo}</span>
                    <span className="ml-2 text-xs text-campo-400">{r.cultivo_codigo}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.ton_cosechadas)}</td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">{fmt(r.stock_fisico)}</td>

                  {/* Silos en campo */}
                  <td className="px-5 py-3">
                    {r.silosCampo.length === 0 ? (
                      r.stock_campo > 0
                        ? <span className="text-campo-700">{fmt(r.stock_campo)}</span>
                        : <span className="text-campo-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {r.silosCampo.map((s: any, j: number) => (
                          <div key={j} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-campo-500">{s.silo_nombre || 'Campo'}</span>
                            <span className="font-medium text-campo-900">{fmt(Number(s.stock_actual))}</span>
                          </div>
                        ))}
                        {r.silosCampo.length > 1 && (
                          <div className="flex items-center justify-between border-t border-campo-100 pt-0.5">
                            <span className="text-xs text-campo-400">Total campo</span>
                            <span className="text-xs font-semibold text-campo-700">{fmt(r.stock_campo)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Acopios: una línea por acopio (Fedea, Morero, etc.), sumando
                      todas sus cargas/lotes en un solo total */}
                  <td className="px-5 py-3">
                    {r.acopiosAgrupados.length === 0 ? (
                      r.stock_acopio > 0
                        ? <span className="text-blue-600">{fmt(r.stock_acopio)}</span>
                        : <span className="text-campo-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {r.acopiosAgrupados.map((a: { nombre: string; total: number }, j: number) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="font-medium text-blue-600">{fmt(a.total)}</span>
                            <span className="text-xs text-blue-500">{a.nombre}</span>
                          </div>
                        ))}
                        {r.acopiosAgrupados.length > 1 && (
                          <div className="flex items-center justify-between border-t border-blue-100 pt-0.5">
                            <span className="text-xs text-campo-400">Total acopio</span>
                            <span className="text-xs font-semibold text-blue-700">{fmt(r.stock_acopio)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.ton_entregadas)}</td>
                  <td className="px-5 py-3 text-right text-orange-600 font-medium">{fmt(r.ton_comprometidas_real)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${r.margen >= 0 ? 'text-campo-600' : 'text-red-500'}`}>
                      {fmt(r.margen)}
                    </span>
                  </td>
                </tr>
              ))}
              {stockConComprometido.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-campo-400">
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
