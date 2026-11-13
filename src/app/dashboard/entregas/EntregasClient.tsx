'use client'

import { useState, useMemo } from 'react'

export default function EntregasClient({ entregas }: { entregas: any[] }) {
  const [busqueda, setBusqueda] = useState('')
  const [patenteSel, setPatenteSel] = useState('')

  const patentes = useMemo(() => {
    const set = new Set<string>()
    entregas.forEach(e => { if (e.patente) set.add(e.patente) })
    return Array.from(set).sort()
  }, [entregas])
  const haySinPatente = useMemo(() => entregas.some(e => !e.patente), [entregas])

  const filtradas = useMemo(() => {
    let base = entregas
    if (patenteSel === '__sin__') base = base.filter(e => !e.patente)
    else if (patenteSel) base = base.filter(e => e.patente === patenteSel)
    if (!busqueda.trim()) return base
    const q = busqueda.toLowerCase()
    return base.filter(e =>
      e.patente?.toLowerCase().includes(q) ||
      e.chofer?.toLowerCase().includes(q) ||
      e.fecha?.includes(q) ||
      e.ctg?.toLowerCase().includes(q) ||
      e.cultivo?.toLowerCase().includes(q) ||
      e.variedad?.toLowerCase().includes(q) ||
      e.campania?.toLowerCase().includes(q) ||
      e.cliente?.toLowerCase().includes(q) ||
      e.contrato?.toLowerCase().includes(q) ||
      e.descripcion_movimiento?.toLowerCase().includes(q) ||
      e.observaciones?.toLowerCase().includes(q)
    )
  }, [entregas, busqueda, patenteSel])

  const totalTon = filtradas.reduce((s, e) => s + Number(e.toneladas ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Buscador */}
      <div className="card p-4 flex gap-3 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-campo-700">Patente</label>
          <select
            value={patenteSel}
            onChange={e => setPatenteSel(e.target.value)}
            className="rounded-lg border border-campo-300 bg-white px-4 py-2.5 text-base font-medium text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[160px]"
          >
            <option value="">Todas</option>
            {patentes.map(p => <option key={p} value={p}>{p}</option>)}
            {haySinPatente && <option value="__sin__">Sin patente</option>}
          </select>
        </div>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por fecha, CTG, patente, chofer, cultivo, campaña, cliente, contrato..."
          className="input-field flex-1 min-w-[240px]"
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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Variedad</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Chofer</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Patente</th>
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
                  <td className="px-4 py-3 text-xs text-emerald-700">{e.variedad ?? <span className="text-campo-300">—</span>}</td>
                  <td className="px-4 py-3 text-campo-600">{e.campania ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">{Number(e.toneladas).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-campo-700">{e.cliente ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{e.contrato ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-campo-600">{e.chofer ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{e.patente ?? <span className="text-campo-300">—</span>}</td>
                  <td className="px-4 py-3">
                    {e.carta_porte_id
                      ? <span className="text-xs bg-campo-100 text-campo-700 px-2 py-0.5 rounded-full font-medium">CPE</span>
                      : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Manual</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-campo-400">{e.descripcion_movimiento || e.observaciones || '—'}</td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-campo-400">Sin entregas registradas</td></tr>
              )}
            </tbody>
            {filtradas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-campo-200 bg-campo-50">
                  <td colSpan={5} className="px-4 py-3 font-bold text-campo-800 text-sm">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-campo-800">{totalTon.toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}