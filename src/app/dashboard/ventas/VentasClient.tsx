'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function VentasClient({ ventas: ventasIniciales }: { ventas: any[] }) {
  const supabase = createClient()
  const [ventas, setVentas] = useState(ventasIniciales)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<any | null>(null)
  const [bonifInput, setBonifInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function abrirModal(e: any) {
    setEditando(e)
    setBonifInput(e.bonificacion ? String(e.bonificacion) : '')
    setError(null)
  }

  function cerrarModal() {
    setEditando(null)
    setBonifInput('')
    setError(null)
  }

  async function guardarBonificacion() {
    if (!editando?.carta_porte_id) return
    setSaving(true)
    setError(null)

    const bonif = parseFloat(bonifInput) || 0

    const { error } = await supabase
      .from('cartas_porte')
      .update({ bonificacion_calidad: bonif })
      .eq('id', editando.carta_porte_id)

    if (error) { setError(error.message); setSaving(false); return }

    const precio_base = Number(editando.precio_base ?? 0)
    const precio_plus = Number(editando.precio_plus ?? 0)
    const comision_tn = Number(editando.comision_tn ?? 0)
    const tarifa_flete = Number(editando.tarifa_flete ?? 0)
    const toneladas = Number(editando.toneladas ?? 0)
    const bonif_usd = precio_base * bonif / 100
    const total_tn = precio_base + bonif_usd + precio_plus - comision_tn - tarifa_flete
    const total_usd = total_tn * toneladas

    setVentas(prev => prev.map(v =>
      v.carta_porte_id === editando.carta_porte_id
        ? { ...v, bonificacion: bonif || null, bonif_usd: bonif_usd || null, total_tn: total_tn || null, total_usd: total_usd || null }
        : v
    ))

    setSaving(false)
    cerrarModal()
  }

  return (
    <>
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
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Flete/tn</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Total/tn</th>
                  <th className="text-right px-4 py-3 font-semibold text-campo-700">Total USD</th>
                  <th className="px-4 py-3"></th>
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
                    <td className="px-4 py-3 text-right text-red-500">{e.tarifa_flete ? `USD ${fmtUSD(e.tarifa_flete)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-campo-800">{e.total_tn ? `USD ${fmtUSD(e.total_tn)}` : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-campo-900">{e.total_usd ? `USD ${fmtUSD(e.total_usd)}` : '—'}</td>
                    <td className="px-4 py-3">
                      {e.carta_porte_id && (
                        <button onClick={() => abrirModal(e)} className="text-xs text-campo-500 hover:text-campo-700 underline">
                          bonif.
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-10 text-center text-campo-400">Sin ventas registradas</td></tr>
                )}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-campo-200 bg-campo-50">
                    <td colSpan={4} className="px-4 py-3 font-bold text-campo-800 text-sm">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-campo-800">{fmt(totalTon)}</td>
                    <td colSpan={8} />
                    <td className="px-4 py-3 text-right font-bold text-campo-900">USD {fmtUSD(totalUSD)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Cargar bonificación</h2>
            <p className="text-sm text-campo-500 mb-1">CTG {editando.ctg ?? '—'}</p>
            <p className="text-xs text-campo-400 mb-4">{editando.cultivo} — {editando.campania} — {fmt(Number(editando.toneladas))} tn</p>

            <label className="block text-sm font-medium text-campo-700 mb-1">% Bonificación</label>
            <input
              type="number"
              step="0.01"
              value={bonifInput}
              onChange={e => setBonifInput(e.target.value)}
              placeholder="2.00"
              className="input-field mb-1"
              autoFocus
            />
            {bonifInput && (
              <p className="text-xs text-campo-500 mb-4">
                USD {fmtUSD(Number(editando.precio_base ?? 0) * parseFloat(bonifInput) / 100)} por tonelada
              </p>
            )}

            {error && <p className="text-red-500 text-sm mb-3">❌ {error}</p>}

            <div className="flex gap-3 justify-end">
              <button onClick={cerrarModal} className="btn-secondary">Cancelar</button>
              <button onClick={guardarBonificacion} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}