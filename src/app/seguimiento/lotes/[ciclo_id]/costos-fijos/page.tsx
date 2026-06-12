'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

type CicloInfo = {
  lote: string
  campo: string
  campana: string
  cultivo: string
  sup_sembrada: number
  hectareas: number
}

type CostoFijo = {
  id: number
  tipo: string
  costo_usd_ha: number | null
  costo_total_usd: number
  observaciones: string | null
}

const TIPOS_COSTO = [
  { value: 'arrendamiento', label: 'Arrendamiento' },
  { value: 'asesor', label: 'Asesoramiento' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'otro', label: 'Otro' },
]

export default function NuevoCostosFijosPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [costos, setCostos] = useState<CostoFijo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  const [form, setForm] = useState({
    tipo: '',
    costo_usd_ha: '',
    costo_total_usd: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)
    const [{ data: cicloData }, { data: costosData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_costos_fijos').select('*').eq('ciclo_id', id).order('tipo'),
    ])
    setCiclo(cicloData ?? null)
    setCostos(costosData ?? [])
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => {
      const updated = { ...f, [name]: value }
      const sup = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0

      // Auto-calcular total desde USD/ha
      if (name === 'costo_usd_ha' && sup > 0) {
        updated.costo_total_usd = (Number(value) * sup).toFixed(2)
      }
      // Auto-calcular USD/ha desde total
      if (name === 'costo_total_usd' && sup > 0) {
        updated.costo_usd_ha = (Number(value) / sup).toFixed(2)
      }

      return updated
    })
  }

  function editarCosto(c: CostoFijo) {
    setEditandoId(c.id)
    setForm({
      tipo: c.tipo,
      costo_usd_ha: c.costo_usd_ha?.toString() ?? '',
      costo_total_usd: c.costo_total_usd?.toString() ?? '',
      observaciones: c.observaciones ?? '',
    })
  }

  function nuevoCosto() {
    setEditandoId(null)
    setForm({ tipo: '', costo_usd_ha: '', costo_total_usd: '', observaciones: '' })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este costo fijo?')) return
    await supabase.from('sa_costos_fijos').delete().eq('id', id)
    cargar()
    if (editandoId === id) nuevoCosto()
  }

  async function handleSubmit() {
    setError(null)
    if (!form.tipo) { setError('El tipo es obligatorio.'); return }
    if (!form.costo_total_usd) { setError('El costo total es obligatorio.'); return }
    setSaving(true)

    const payload: any = {
      ciclo_id: Number(ciclo_id),
      tipo: form.tipo,
      costo_usd_ha: form.costo_usd_ha ? Number(form.costo_usd_ha) : null,
      costo_total_usd: Number(form.costo_total_usd),
      observaciones: form.observaciones || null,
    }

    if (editandoId) {
      const { error: err } = await supabase.from('sa_costos_fijos').update(payload).eq('id', editandoId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('sa_costos_fijos').insert(payload)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    }

    setSaving(false)
    await cargar()
    nuevoCosto()
  }

  const fmtUsd = (n: number | null) => n != null ? `USD ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '—'
  const totalGeneral = costos.reduce((acc, c) => acc + Number(c.costo_total_usd ?? 0), 0)
  const TIPO_LABELS: Record<string, string> = { arrendamiento: 'Arrendamiento', asesor: 'Asesoramiento', seguro: 'Seguro', otro: 'Otro' }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">Costos Fijos</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
        <p className="text-xs text-campo-400 mt-0.5">Superficie: {ciclo.sup_sembrada ?? ciclo.hectareas} ha</p>
      </div>

      {/* Lista existente */}
      {costos.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50 flex items-center justify-between">
            <h2 className="font-semibold text-campo-700 text-sm">Costos registrados</h2>
            <span className="text-xs text-campo-500">Total: <span className="font-semibold text-campo-900">{fmtUsd(totalGeneral)}</span></span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100">
                <th className="text-left px-4 py-2 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">USD/ha</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">Total USD</th>
                <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {costos.map(c => (
                <tr key={c.id} className={`border-b border-campo-50 hover:bg-campo-50/50 ${editandoId === c.id ? 'bg-lime-50' : ''}`}>
                  <td className="px-4 py-2 font-medium text-campo-900">{TIPO_LABELS[c.tipo] ?? c.tipo}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{c.costo_usd_ha ? `USD ${Number(c.costo_usd_ha).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(c.costo_total_usd)}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => editarCosto(c)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
                      <button onClick={() => handleBorrar(c.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulario */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-campo-800">{editandoId ? 'Editar costo' : '+ Nuevo costo fijo'}</h2>
          {editandoId && <button onClick={nuevoCosto} className="text-xs text-campo-400 hover:text-campo-700">✕ Cancelar edición</button>}
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Tipo *</label>
          <select name="tipo" value={form.tipo} onChange={handleChange}
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Seleccionar...</option>
            {TIPOS_COSTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Costo (USD/ha)</label>
            <input type="number" name="costo_usd_ha" value={form.costo_usd_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            <p className="text-xs text-campo-400 mt-1">Completa el total automáticamente</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Total USD *</label>
            <input type="number" name="costo_total_usd" value={form.costo_total_usd} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            <p className="text-xs text-campo-400 mt-1">O ingresá el total y calcula USD/ha</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar costo'}
          </button>
          <button onClick={() => window.close()}
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
