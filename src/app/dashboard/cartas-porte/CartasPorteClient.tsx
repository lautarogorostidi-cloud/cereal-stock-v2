'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const estadoColor: Record<string, string> = {
  emitida:     'badge-trigo',
  en_transito: 'badge-azul',
  descargada:  'badge-verde',
  anulada:     'badge-rojo',
}

export default function CartasPorteClient({ cartas, contratos }: { cartas: any[], contratos: any[] }) {
  const supabase = createClient()
  const [lista, setLista] = useState(cartas)
  const [editando, setEditando] = useState<any | null>(null)
  const [contratoSel, setContratoSel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function abrirModal(carta: any) {
    setEditando(carta)
    setContratoSel(carta.contrato_id ?? '')
    setError(null)
  }

  function cerrarModal() {
    setEditando(null)
    setContratoSel('')
    setError(null)
  }

  async function guardar() {
    if (!editando) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('cartas_porte')
      .update({ contrato_id: contratoSel || null })
      .eq('id', editando.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    // Actualizar lista local
    const contratoNumero = contratos.find(c => c.id === contratoSel)?.numero ?? null
    setLista(prev => prev.map(c =>
      c.id === editando.id
        ? { ...c, contrato_id: contratoSel || null, contratos: contratoNumero ? { numero: contratoNumero } : null }
        : c
    ))
    setSaving(false)
    cerrarModal()
  }

  return (
    <>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Nº CPE</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Tn Origen</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Humedad</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Tn Netas</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Contrato</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map(c => (
                <tr key={c.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{c.numero_cpe}</td>
                  <td className="px-4 py-3 text-campo-600">{new Date(c.fecha_emision).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{c.cultivos?.nombre}</td>
                  <td className="px-4 py-3 text-campo-600">{c.campanias?.nombre}</td>
                  <td className="px-4 py-3 text-right">{Number(c.toneladas_origen).toLocaleString('es-AR', { minimumFractionDigits: 3 })}</td>
                  <td className="px-4 py-3 text-right text-campo-500">{c.humedad_origen ? `${c.humedad_origen}%` : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-800">
                    {c.toneladas_netas ? Number(c.toneladas_netas).toLocaleString('es-AR', { minimumFractionDigits: 3 }) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-campo-500">{c.contratos?.numero ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={estadoColor[c.estado] ?? 'badge-gris'}>{c.estado.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => abrirModal(c)} className="text-xs text-campo-500 hover:text-campo-700 underline">
                      editar
                    </button>
                  </td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-campo-400">
                    No hay cartas de porte registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {editando && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-campo-900 mb-1">Vincular contrato</h2>
            <p className="text-sm text-campo-500 mb-4">CPE {editando.numero_cpe}</p>

            <label className="block text-sm font-medium text-campo-700 mb-1">Contrato</label>
            <select
              value={contratoSel}
              onChange={e => setContratoSel(e.target.value)}
              className="input-field mb-4"
            >
              <option value="">Sin contrato</option>
              {contratos.map(c => (
                <option key={c.id} value={c.id}>#{c.numero} — {c.cultivos?.nombre} — {c.campanias?.nombre}</option>
              ))}
            </select>

            {error && <p className="text-red-500 text-sm mb-3">❌ {error}</p>}

            <div className="flex gap-3 justify-end">
              <button onClick={cerrarModal} className="btn-secondary">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
