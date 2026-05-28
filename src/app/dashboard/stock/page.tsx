import { createClient } from '@/lib/supabase/server'

export default async function StockPage() {
  const supabase = createClient()
  const { data: stock } = await supabase.from('vw_stock_actual').select('*')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Cereal</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición física y disponible por cultivo</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Cosechado</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Stock Físico</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Vendido</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Comprometido</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {stock?.map((r, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 text-campo-600">{r.campania}</td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-campo-900">{r.cultivo}</span>
                    <span className="ml-2 text-xs text-campo-400">{r.cultivo_codigo}</span>
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">{Number(r.ton_cosechadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">{Number(r.stock_fisico).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-5 py-3 text-right text-tierra-700">{Number(r.ton_vendidas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-5 py-3 text-right text-orange-600">{Number(r.ton_comprometidas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${Number(r.stock_disponible) > 0 ? 'text-campo-600' : 'text-red-500'}`}>
                      {Number(r.stock_disponible).toLocaleString('es-AR', { minimumFractionDigits: 1 })}
                    </span>
                  </td>
                </tr>
              ))}
              {(!stock || stock.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-campo-400">
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
