'use client'

import { useState, useMemo } from 'react'

export default function EntregasClient({ entregas }: { entregas: any[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return entregas
    const q = busqueda.toLowerCase()
    return entregas.filter(e =>
      e.fecha?.includes(q) ||
      e.ctg?.toLowerCase().includes(q) ||
      e.cultivo?.toLowerCase().includes(q) ||
      e.campania?.toLowerCase().includes(q) ||
      e.cliente?.toLowerCase().includes(q) ||
      e.contrato?.toLowerCase().includes(q) ||
      e.descripcion_movimiento?.toLowerCase().includes(q)
    )
  }, [entregas, busqueda])

  const totalTon = filtradas.reduce((s, e) => s + Number(e.toneladas ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Buscador */}
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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Origen</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{e.fecha ? new Date(e.fecha).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">
                    {e.ctg ? (
                      e.carta_porte_id
                        ? <a href="/dashboard/cartas-porte" className="text-campo-600 underline hover:text-campo-800">{e.ctg}</a>
                        : e.ctg
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-campo-900">{e.cultivo ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{e.campania ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">{Number(e.toneladas).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-campo-700">{e.cliente ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.contrato ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.carta_porte_id
                      ? <span className="text-xs bg-campo-100 text-campo-700 px-2 py-0.5 rounded-full font-medium">CPE</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Manual</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-campo-400">{e.descripcion_movimiento ?? '—'}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-campo-400">Sin entregas registradas</td></tr>
              )}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-campo-200 bg-campo-50">
                  <td colSpan={4} className="px-4 py-3 font-bold text-campo-800 text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-campo-800">{totalTon.toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}