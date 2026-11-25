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

type Labor = {
  id: number
  tipo: 'desmalezada' | 'hilerada' | 'rollos'
  fecha: string | null
  superficie_ha: number | null
  cantidad_rollos: number | null
  costo_usd_ha: number | null
  proveedor: string | null
  observaciones: string | null
}

const TIPOS: { value: Labor['tipo']; label: string }[] = [
  { value: 'desmalezada', label: 'Desmalezada' },
  { value: 'hilerada', label: 'Hilerada' },
  { value: 'rollos', label: 'Confección de rollos' },
]
const etiquetaTipo = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t

const FORM_VACIO = { tipo: '', fecha: '', superficie_ha: '', cantidad_rollos: '', costo_usd_ha: '', proveedor: '', observaciones: '' }

export default function ConfeccionRollosPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [registros, setRegistros] = useState<Labor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(FORM_VACIO)

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)
    const [{ data: cicloData }, { data: labores }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_forraje').select('*').eq('ciclo_id', id).order('fecha', { ascending: true, nullsFirst: false }).order('id'),
    ])
    setCiclo(cicloData ?? null)
    setRegistros((labores ?? []) as Labor[])
    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0
    setForm(f => (f.superficie_ha ? f : { ...f, superficie_ha: supDefault ? String(supDefault) : '' }))
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function supPorDefecto() {
    const s = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0
    return s ? String(s) : ''
  }

  function nuevoReg() {
    setEditandoId(null)
    setForm({ ...FORM_VACIO, superficie_ha: supPorDefecto() })
  }

  function editarReg(r: Labor) {
    setEditandoId(r.id)
    setForm({
      tipo: r.tipo,
      fecha: r.fecha ?? '',
      superficie_ha: r.superficie_ha?.toString() ?? '',
      cantidad_rollos: r.cantidad_rollos?.toString() ?? '',
      costo_usd_ha: r.costo_usd_ha?.toString() ?? '',
      proveedor: r.proveedor ?? '',
      observaciones: r.observaciones ?? '',
    })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este registro?')) return
    await supabase.from('sa_forraje').delete().eq('id', id)
    if (editandoId === id) nuevoReg()
    cargar()
  }

  async function handleSubmit() {
    setError(null)
    if (!form.tipo) { setError('Elegí la labor (desmalezada, hilerada o confección de rollos).'); return }
    if (!form.superficie_ha || Number(form.superficie_ha) <= 0) { setError('La cantidad de hectáreas es obligatoria.'); return }
    if (form.tipo === 'rollos' && (form.cantidad_rollos === '' || Number(form.cantidad_rollos) < 0)) {
      setError('Cargá la cantidad de rollos.')
      return
    }
    setSaving(true)

    const payload = {
      ciclo_id: Number(ciclo_id),
      tipo: form.tipo,
      fecha: form.fecha || null,
      superficie_ha: Number(form.superficie_ha),
      cantidad_rollos: form.tipo === 'rollos' && form.cantidad_rollos !== '' ? Number(form.cantidad_rollos) : null,
      costo_usd_ha: form.costo_usd_ha ? Number(form.costo_usd_ha) : null,
      proveedor: form.proveedor.trim() || null,
      observaciones: form.observaciones.trim() || null,
    }

    const { error: err } = editandoId
      ? await supabase.from('sa_forraje').update(payload).eq('id', editandoId)
      : await supabase.from('sa_forraje').insert(payload)
    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    setEditandoId(null)
    setForm({ ...FORM_VACIO, tipo: form.tipo, superficie_ha: supPorDefecto() })
    await cargar()
  }

  const fmt = (n: number | null | undefined, dec = 1) => n != null ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'
  const fmtUsd = (n: number | null | undefined) => n != null && Number(n) > 0 ? `USD ${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '—'
  const fmtFecha = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'
  const totalDe = (r: Labor) => Number(r.superficie_ha ?? 0) * Number(r.costo_usd_ha ?? 0)

  const costoForm = Number(form.superficie_ha || 0) * Number(form.costo_usd_ha || 0)
  const rollosPorHa = form.tipo === 'rollos' && Number(form.superficie_ha) > 0 && form.cantidad_rollos !== ''
    ? Number(form.cantidad_rollos) / Number(form.superficie_ha) : null
  const usdPorRollo = form.tipo === 'rollos' && Number(form.cantidad_rollos) > 0 && costoForm > 0
    ? costoForm / Number(form.cantidad_rollos) : null

  const totalCosto = registros.reduce((acc, r) => acc + totalDe(r), 0)
  const totalRollos = registros.reduce((acc, r) => acc + (r.tipo === 'rollos' ? Number(r.cantidad_rollos ?? 0) : 0), 0)

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400'

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">Confección de rollos</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      {registros.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50 flex items-center justify-between">
            <h2 className="font-semibold text-campo-700 text-sm">Registros</h2>
            <span className="text-xs text-campo-500">
              {totalRollos > 0 && <>{fmt(totalRollos, 0)} rollos · </>}Costo total: <b className="text-campo-900">{fmtUsd(totalCosto)}</b>
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Fecha</th>
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Labor</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Ha</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Rollos</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">USD/ha</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Total</th>
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Proveedor</th>
                  <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id} className={`border-b border-campo-50 hover:bg-campo-50/50 ${editandoId === r.id ? 'bg-lime-50' : ''}`}>
                    <td className="px-4 py-2 text-campo-600">{fmtFecha(r.fecha)}</td>
                    <td className="px-4 py-2 font-medium text-campo-900">{etiquetaTipo(r.tipo)}</td>
                    <td className="px-4 py-2 text-right text-campo-600">{fmt(r.superficie_ha)}</td>
                    <td className="px-4 py-2 text-right text-campo-600">{r.tipo === 'rollos' ? fmt(r.cantidad_rollos, 0) : '—'}</td>
                    <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(r.costo_usd_ha)}</td>
                    <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(totalDe(r))}</td>
                    <td className="px-4 py-2 text-campo-600">{r.proveedor ?? '—'}</td>
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
        </div>
      )}

      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-campo-800">{editandoId ? 'Editar registro' : '+ Nuevo registro'}</h2>
          {editandoId && <button onClick={nuevoReg} className="text-xs text-campo-400 hover:text-campo-700">✕ Cancelar edición</button>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Labor *</label>
            <select name="tipo" value={form.tipo} onChange={handleChange} className={inp}>
              <option value="">Seleccionar...</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className={inp} />
          </div>
        </div>

        <div className={`grid gap-4 ${form.tipo === 'rollos' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Cantidad de ha *</label>
            <input type="number" name="superficie_ha" value={form.superficie_ha} onChange={handleChange} step="0.01" min="0" placeholder="0" className={inp} />
          </div>
          {form.tipo === 'rollos' && (
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Cantidad de rollos *</label>
              <input type="number" name="cantidad_rollos" value={form.cantidad_rollos} onChange={handleChange} step="1" min="0" placeholder="0" className={inp} />
              {rollosPorHa != null && <p className="text-xs text-campo-400 mt-1">{fmt(rollosPorHa, 1)} rollos/ha</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Costo servicio (USD/ha)</label>
            <input type="number" name="costo_usd_ha" value={form.costo_usd_ha} onChange={handleChange} step="0.01" min="0" placeholder="0" className={inp} />
            {costoForm > 0 && (
              <p className="text-xs text-campo-400 mt-1">
                Total: {fmtUsd(costoForm)}{usdPorRollo != null && <> · USD {fmt(usdPorRollo, 2)}/rollo</>}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor del servicio</label>
          <input type="text" name="proveedor" value={form.proveedor} onChange={handleChange} placeholder="Ej: Baratza SRL" className={inp} />
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={2} placeholder="Notas adicionales..." className={`${inp} resize-none`} />
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
