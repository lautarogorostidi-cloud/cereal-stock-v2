'use client'

import { useState, useMemo } from 'react'

export default function ReportesClient({ resultados }: { resultados: any[] }) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return resultados
    const q = busqueda.toLowerCase()
    return resultados.filter(r =>
      r.campania?.toLowerCase().includes(q) ||
      r.cultivo?.toLowerCase().includes(q) ||
      r.cliente?.toLowerCase().includes(q) ||
      r.ctg?.toLowerCase().includes(q) ||
      String(r.contrato ?? '').toLowerCase().includes(q) ||
      r.destino_localidad?.toLowerCase().includes(q) ||
      r.chofer_nombre?.toLowerCase().includes(q)
    )
  }, [resultados, busqueda])

  const totalTon = filtrados.reduce((s, r) => s + Number(r.ton_totales ?? 0), 0)
  const totalBonif = filtrados.reduce((s, r) => s + Number(r.bonificacion_usd_total ?? 0), 0)
  const totalComision = filtrados.reduce((s, r) => s + Number(r.comision_total ?? 0), 0)
  const totalFlete = filtrados.reduce((s, r) => s + Number(r.total_flete ?? 0), 0)
  const totalNeto = filtrados.reduce((s, r) => s + Number(r.ingreso_neto_total ?? 0), 0)

  const fmt3 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const fmt2 = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmt0 = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 })

  function descargarCSV() {
    const headers = [
      'Fecha', 'CTG', 'N° Turno', 'Campaña', 'Cultivo', 'Cliente', 'Contrato',
      'Patente Camión', 'Patente Acoplado', 'Chofer',
      'Destino Localidad', 'Destino Provincia',
      'Toneladas', 'Precio Base', 'Plus', 'Bonif %', 'Bonif USD',
      'Comisión %', 'Comisión USD', 'Flete/tn', 'Total Flete',
      'Neto Total', 'Precio Neto/tn'
    ]

    const rows = filtrados.map(r => [
      r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '',
      r.ctg ?? '',
      r.nro_turno ?? '',
      r.campania ?? '',
      r.cultivo ?? '',
      r.cliente ?? '',
      r.contrato ?? '',
      r.patente_camion ?? '',
      r.patente_acoplado ?? '',
      r.chofer_nombre ?? '',
      r.destino_localidad ?? '',
      r.destino_provincia ?? '',
      Number(r.ton_totales ?? 0).toFixed(3),
      Number(r.precio_base ?? 0).toFixed(2),
      Number(r.plus ?? 0).toFixed(2),
      Number(r.bonificacion_pct ?? 0).toFixed(2),
      Number(r.bonificacion_usd_total ?? 0).toFixed(2),
      Number(r.comision_pct ?? 0).toFixed(2),
      Number(r.comision_total ?? 0).toFixed(2),
      Number(r.tarifa_flete ?? 0).toFixed(2),
      Number(r.total_flete ?? 0).toFixed(2),
      Number(r.ingreso_neto_total ?? 0).toFixed(2),
      Number(r.precio_neto_promedio ?? 0).toFixed(2),
    ])

    const csv = [
      headers.map(h => `"${h}"`),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`))
    ].map(r => r.join(';')).join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-comercial-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-1">Toneladas</div>
          <div className="text-xl font-bold text-campo-800">{fmt3(totalTon)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-1">Bonificación</div>
          <div className="text-xl font-bold text-green-600">USD {fmt2(totalBonif)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-1">Comisión</div>
          <div className="text-xl font-bold text-red-500">USD {fmt2(totalComision)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-1">Flete</div>
          <div className="text-xl font-bold text-red-500">USD {fmt2(totalFlete)}</div>
        </div>
        <div className="card text-center">
          <div className="text-xs font-semibold text-campo-400 uppercase tracking-wider mb-1">Ingreso Neto</div>
          <div className="text-xl font-bold text-campo-600">USD {fmt0(totalNeto)}</div>
        </div>
      </div>

      <div className="card p-4 flex gap-3 items-center">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por fecha, CTG, campaña, cultivo, cliente, contrato, chofer, destino..."
          className="input-field flex-1"
        />
        <button onClick={descargarCSV} className="btn-secondary whitespace-nowrap">
          ⬇ Descargar CSV
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">CTG</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Destino</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Chofer</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Toneladas</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio Base</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Plus</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Bonif %</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Bonif USD</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Comisión</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Flete/tn</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Neto Total</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio Neto/tn</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{r.fecha ? new Date(r.fecha).toLocaleDateString('es-AR') : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{r.ctg ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{r.campania}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{r.cultivo}</td>
                  <td className="px-4 py-3 text-campo-700">{r.cliente}</td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{r.contrato}</td>
                  <td className="px-4 py-3 text-xs text-campo-600">{r.destino_localidad ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-campo-600">{r.chofer_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt3(Number(r.ton_totales ?? 0))}</td>
                  <td className="px-4 py-3 text-right text-campo-700">
                    {r.precio_base == null ? (
                      <span className="text-orange-500 text-xs">Sin tipo de cambio</span>
                    ) : (
                      <>
                        USD {fmt2(Number(r.precio_base))}
                        {r.moneda_original && r.moneda_original !== 'USD' && (
                          <div className="text-[10px] text-campo-400 font-normal">
                            {r.moneda_original} → TC {fmt2(Number(r.tipo_cambio_usado))}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-campo-700">{r.plus != null && Number(r.plus) > 0 ? `USD ${fmt2(Number(r.plus))}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{Number(r.bonificacion_pct ?? 0) > 0 ? `${fmt2(Number(r.bonificacion_pct))}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-green-600">{r.bonificacion_usd_total != null && Number(r.bonificacion_usd_total) > 0 ? `USD ${fmt2(Number(r.bonificacion_usd_total))}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-red-500">{r.comision_total == null ? '—' : `USD ${fmt2(Number(r.comision_total))}`}</td>
                  <td className="px-4 py-3 text-right text-red-500">{Number(r.tarifa_flete ?? 0) > 0 ? `USD ${fmt2(Number(r.tarifa_flete))}` : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-campo-900">{r.ingreso_neto_total == null ? '—' : `USD ${fmt2(Number(r.ingreso_neto_total))}`}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">{r.precio_neto_promedio == null ? '—' : `USD ${fmt2(Number(r.precio_neto_promedio))}`}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={17} className="px-4 py-10 text-center text-campo-400">Sin datos</td></tr>
              )}
            </tbody>
            {filtrados.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-campo-200 bg-campo-50">
                  <td colSpan={8} className="px-4 py-3 font-bold text-campo-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-campo-800">{fmt3(totalTon)}</td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-right font-bold text-green-600">USD {fmt2(totalBonif)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">USD {fmt2(totalComision)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">USD {fmt2(totalFlete)}</td>
                  <td className="px-4 py-3 text-right font-bold text-campo-900">USD {fmt2(totalNeto)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}