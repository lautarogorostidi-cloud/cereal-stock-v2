'use client'

import { useMemo, useState } from 'react'

type AcopioAgrupado = { nombre: string; total: number }

type StockRow = {
  campania: string
  cultivo: string
  cultivo_codigo: string
  ton_cosechadas: number
  ton_entregadas: number
  ton_comprometidas_real: number
  stock_fisico: number
  margen: number
  stock_campo: number
  stock_acopio: number
  silosCampo: any[]
  acopiosAgrupados: AcopioAgrupado[]
}

function fmt(n: number | null | undefined) {
  const num = Number(n ?? 0)
  return isNaN(num) ? '0,0' : num.toLocaleString('es-AR', { minimumFractionDigits: 1 })
}

export default function StockClient({ rows, campanias }: { rows: StockRow[]; campanias: string[] }) {
  const [campaniaSel, setCampaniaSel] = useState<string>(campanias[0] ?? 'todas')

  const filtradas = useMemo(
    () => (campaniaSel === 'todas' ? rows : rows.filter(r => r.campania === campaniaSel)),
    [rows, campaniaSel]
  )

  const totalCampo = filtradas.reduce((s, r) => s + r.stock_campo, 0)
  const totalAcopio = filtradas.reduce((s, r) => s + r.stock_acopio, 0)
  const totalFisico = filtradas.reduce((s, r) => s + r.stock_fisico, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Stock de Cereal</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición física y disponible por cultivo</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-campo-700">Campaña</label>
          <select
            value={campaniaSel}
            onChange={e => setCampaniaSel(e.target.value)}
            className="input-field w-auto"
          >
            <option value="todas">Todas las campañas</option>
            {campanias.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
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
              {filtradas.map((r, i) => (
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
                        {r.acopiosAgrupados.map((a, j: number) => (
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
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-campo-400">
                    No hay stock registrado para esta campaña
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
