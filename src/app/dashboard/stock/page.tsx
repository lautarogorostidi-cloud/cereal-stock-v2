import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StockPage() {
  const supabase = createClient()

  const [{ data: stock }, { data: comprometido }, { data: porDestino }] = await Promise.all([
    supabase.from('vw_stock_actual').select('*'),
    supabase.from('vw_comprometido').select('*'),
    supabase.from('vw_stock_por_destino').select('*'),
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

    // Destinos de acopio con nombre para esta fila
    const acopios = (porDestino ?? []).filter(
      d => d.campania === r.campania && d.cultivo === r.cultivo && d.ubicacion === 'acopio'
    )

    return { ...r, ton_comprometidas_real, stock_fisico, margen, stock_campo, stock_acopio, acopios }
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
                <th className="text-right px-5 py-3 font-semibold text-campo-700">En campo</th>
                <th className="text-left px-5 py-3 font-semibold text-blue-600">En acopio</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Entregado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Comprometido</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Margen para Vender</th>
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
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(r.stock_fisico)}</td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {r.stock_campo > 0 ? fmt(r.stock_campo) : <span className="text-campo-300">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {r.acopios.length === 0 ? (
                      <span className="text-campo-300">—</span>
                    ) : (
                      <div className="space-y-0.5">
                        {r.acopios.map((a: any, j: number) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="text-blue-600 font-medium">{fmt(Number(a.stock_actual))}</span>
                            <span className="text-xs text-blue-500">{a.acopio_nombre ?? 'Acopio s/n'}</span>
                          </div>
                        ))}
                        {r.acopios.length > 1 && (
                          <div className="text-xs text-campo-400 border-t border-campo-100 pt-0.5">
                            Total: {fmt(r.stock_acopio)}
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
