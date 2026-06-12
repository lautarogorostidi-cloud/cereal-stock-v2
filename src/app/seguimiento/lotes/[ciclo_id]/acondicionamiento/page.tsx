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

type Acondicionamiento = {
  id: number
  fecha: string | null
  tipo_laboreo: string | null
  superficie_ha: number | null
  costo_usd_ha: number | null
  proveedor: string | null
  observaciones: string | null
}

const TIPOS_LABOREO = ['Cincel', 'Rastra de disco', 'Subsolador', 'Arado de reja', 'Rotovator', 'Otro']

export default function NuevaAcondicionamientoPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [registros, setRegistros] = useState<Acondicionamiento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  const [form, setForm] = useState({
    fecha: '',
    tipo_laboreo: '',
    superficie_ha: '',
    costo_usd_ha: '',
    proveedor: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)
    const [{ data: cicloData }, { data: acsData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_acondicionamiento').select('*').eq('ciclo_id', id).order('fecha'),
    ])
    setCiclo(cicloData ?? null)
    setRegistros(acsData ?? [])
    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0
    setForm(f => ({ ...f, superficie_ha: supDefault.toString() }))
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function editarReg(r: Acondicionamiento) {
    setEditandoId(r.id)
    setForm({
      fecha: r.fecha ?? '',
      tipo_laboreo: r.tipo_laboreo ?? '',
      superficie_ha: r.superficie_ha?.toString() ?? '',
      costo_usd_ha: r.costo_usd_ha?.toString() ?? '',
      proveedor: r.proveedor ?? '',
      observaciones: r.observaciones ?? '',
    })
  }

  function nuevoReg() {
    setEditandoId(null)
    const supDefault = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0
    setForm({ fecha: '', tipo_laboreo: '', superficie_ha: supDefault.toString(), costo_usd_ha: '', proveedor: '', observaciones: '' })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este registro?')) return
    await supabase.from('sa_acondicionamiento').delete().eq('id', id)
    cargar()
    if (editandoId === id) nuevoReg()
  }

  async function handleSubmit() {
    setError(null)
    if (!form.tipo_laboreo) { setError('El tipo de laboreo es obligatorio.'); return }
    if (!form.superficie_ha) { setError('La superficie es obligatoria.'); return }
    setSaving(true)

    const payload: any = {
      ciclo_id: Number(ciclo_id),
      fecha: form.fecha || null,
      tipo_laboreo: form.tipo_laboreo,
      superficie_ha: Number(form.superficie_ha),
      costo_usd_ha: form.costo_usd_ha ? Number(form.costo_usd_ha) : null,
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
    }

    if (editandoId) {
      const { error: err } = await supabase.from('sa_acondicionamiento').update(payload).eq('id', editandoId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('sa_acondicionamiento').insert(payload)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    }

    setSaving(false)
    await cargar()
    nuevoReg()
  }

  const fmt = (n: number | null) => n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: 1 }) : '—'
  const fmtUsd = (n: number | null) => n != null && n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '—'
  const fmtFecha = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'
  const costoTotal = Number(form.superficie_ha || 0) * Number(form.costo_usd_ha || 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">Acondicionamiento de suelo</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      {registros.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Registros</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100">
                <th className="text-left px-4 py-2 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-2 font-semibold text-campo-700">Tipo laboreo</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">Sup (ha)</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">USD/ha</th>
                <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id} className={`border-b border-campo-50 hover:bg-campo-50/50 ${editandoId === r.id ? 'bg-lime-50' : ''}`}>
                  <td className="px-4 py-2 text-campo-600">{fmtFecha(r.fecha)}</td>
                  <td className="px-4 py-2 font-medium text-campo-900">{r.tipo_laboreo}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmt(r.superficie_ha)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(r.costo_usd_ha)}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => editarReg(r)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
                      <button onClick={() => handleBorrar(r.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-campo-800">{editandoId ? 'Editar registro' : '+ Nuevo registro'}</h2>
          {editandoId && <button onClick={nuevoReg} className="text-xs text-campo-400 hover:text-campo-700">✕ Cancelar edición</button>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo de laboreo *</label>
            <select name="tipo_laboreo" value={form.tipo_laboreo} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar...</option>
              {TIPOS_LABOREO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Superficie (ha) *</label>
            <input type="number" name="superficie_ha" value={form.superficie_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Costo servicio (USD/ha)</label>
            <input type="number" name="costo_usd_ha" value={form.costo_usd_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoTotal)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor</label>
            <input type="text" name="proveedor" value={form.proveedor} onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar registro'}
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
