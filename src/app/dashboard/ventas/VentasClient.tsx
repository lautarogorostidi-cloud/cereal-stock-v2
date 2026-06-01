'use client'

import { useState, useMemo } from 'react'

export default function VentasClient({ ventas }: { ventas: any[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return ventas
    const q = busqueda.toLowerCase()
    return ventas.filter(e =>
      e.fecha?.includes(q) ||
      e.ctg?.toLowerCase().includes(q) ||
      e.cultivo?.toLowerCase().includes(q) ||
      e.campania?.toLowerCase().includes(q) ||
      e.cliente?.toLowerCase().includes(q) ||
      String(e.contrato ?? '').toLowerCase().includes(q)
    )
  }, [ventas, busqueda])

  const totalTon = filtradas.reduce((s, e) => s + Number(e.toneladas ?? 0), 0)
  const totalUSD = filtradas.reduce((s, e) => s + Number(e.total_usd ?? 0), 0)

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const fmtUSD = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por fecha, CTG, cultivo, campaña, cliente, contrato..."
          className="input-field"
        />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">CTG</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio Base</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Plus</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Bonificación</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Comisión/tn</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Total/tn</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Total USD</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{e.fecha ? new Date(e.fecha).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.ctg ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{e.cultivo ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{e.campania ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">{fmt(Number(e.toneladas ?? 0))}</td>
                  <td className="px-4 py-3 text-campo-700">{e.cliente ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.contrato ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{e.precio_base ? `USD ${fmtUSD(e.precio_base)}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{e.precio_plus ? `USD ${fmtUSD(e.precio_plus)}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-campo-700">
                    {e.bonificacion
                      ? <span>USD {fmtUSD(e.bonif_usd)} <span className="text-xs text-campo-400">({e.bonificacion}%)</span></span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-red-500">{e.comision_tn ? `USD ${fmtUSD(e.comision_tn)}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">{e.total_tn ? `USD ${fmtUSD(e.total_tn)}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-campo-900">{e.total_usd ? `USD ${fmtUSD(e.total_usd)}` : '—'}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={13} className="px-4 py-10 text-center text-campo-400">Sin ventas registradas</td></tr>
              )}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-campo-200 bg-campo-50">
                  <td colSpan={4} className="px-4 py-3 font-bold text-campo-800 text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-campo-800">{fmt(totalTon)}</td>
                  <td colSpan={7} />
                  <td className="px-4 py-3 text-right font-bold text-campo-900">USD {fmtUSD(totalUSD)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}