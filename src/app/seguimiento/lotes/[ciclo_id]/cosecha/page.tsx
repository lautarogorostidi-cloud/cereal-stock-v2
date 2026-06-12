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

export default function NuevaCosechaPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [esEdicion, setEsEdicion] = useState(false)
  const [cosechaId, setCosechaId] = useState<number | null>(null)
  const [tarifarioServicios, setTarifarioServicios] = useState<any[]>([])

  const [form, setForm] = useState({
    fecha: '',
    superficie_ha: '',
    humedad_pct: '',
    rinde_kg_total: '',
    rinde_kg_ha_cosecha: '',
    rinde_kg_ha_sembrada: '',
    rinde_estimado_kg_ha: '',
    rinde_presupuestado_kg_ha: '',
    costo_cosecha_usd_ha: '',
    proveedor_cosecha: '',
    observaciones: '',
  })

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)
    const [{ data: cicloData }, { data: cosechaData }, { data: servicios }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_cosechas').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
    ])
    setCiclo(cicloData ?? null)
    setTarifarioServicios(servicios ?? [])

    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0

    if (cosechaData) {
      setEsEdicion(true)
      setCosechaId(cosechaData.id)
      setForm({
        fecha: cosechaData.fecha ?? '',
        superficie_ha: cosechaData.superficie_ha?.toString() ?? '',
        humedad_pct: cosechaData.humedad_pct?.toString() ?? '',
        rinde_kg_total: cosechaData.rinde_kg_total?.toString() ?? '',
        rinde_kg_ha_cosecha: cosechaData.rinde_kg_ha_cosecha?.toString() ?? '',
        rinde_kg_ha_sembrada: cosechaData.rinde_kg_ha_sembrada?.toString() ?? '',
        rinde_estimado_kg_ha: cosechaData.rinde_estimado_kg_ha?.toString() ?? '',
        rinde_presupuestado_kg_ha: cosechaData.rinde_presupuestado_kg_ha?.toString() ?? '',
        costo_cosecha_usd_ha: cosechaData.costo_cosecha_usd_ha?.toString() ?? '',
        proveedor_cosecha: cosechaData.proveedor_cosecha ?? '',
        observaciones: cosechaData.observaciones ?? '',
      })
    } else {
      setForm(f => ({ ...f, superficie_ha: supDefault.toString() }))
    }
    setLoading(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => {
      const updated = { ...f, [name]: value }

      // Auto-calcular rinde_kg_ha_cosecha si tenemos total y superficie
      if (name === 'rinde_kg_total' || name === 'superficie_ha') {
        const total = Number(name === 'rinde_kg_total' ? value : f.rinde_kg_total)
        const sup = Number(name === 'superficie_ha' ? value : f.superficie_ha)
        if (total > 0 && sup > 0) {
          updated.rinde_kg_ha_cosecha = (total / sup).toFixed(1)
        }
      }

      // Auto-calcular rinde_kg_ha_sembrada
      if (name === 'rinde_kg_total') {
        const total = Number(value)
        const supSembrada = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0
        if (total > 0 && supSembrada > 0) {
          updated.rinde_kg_ha_sembrada = (total / supSembrada).toFixed(1)
        }
      }

      // Auto-completar costo cosecha desde tarifario
      if (name === 'fecha' && value && ciclo) {
        const registros = tarifarioServicios.filter(s =>
          s.tipo_servicio?.toLowerCase().includes('cosecha') &&
          (!s.cultivo || s.cultivo === ciclo.cultivo) &&
          s.vigencia_desde <= value
        ).sort((a: any, b: any) => b.vigencia_desde.localeCompare(a.vigencia_desde))
        if (registros.length > 0) {
          updated.costo_cosecha_usd_ha = registros[0].costo_usd_ha.toString()
        }
      }

      return updated
    })
  }

  async function handleSubmit() {
    setError(null)
    if (!form.superficie_ha) { setError('La superficie es obligatoria.'); return }
    setSaving(true)

    const payload: any = {
      ciclo_id: Number(ciclo_id),
      fecha: form.fecha || null,
      superficie_ha: form.superficie_ha ? Number(form.superficie_ha) : null,
      humedad_pct: form.humedad_pct ? Number(form.humedad_pct) : null,
      rinde_kg_total: form.rinde_kg_total ? Number(form.rinde_kg_total) : null,
      rinde_kg_ha_cosecha: form.rinde_kg_ha_cosecha ? Number(form.rinde_kg_ha_cosecha) : null,
      rinde_kg_ha_sembrada: form.rinde_kg_ha_sembrada ? Number(form.rinde_kg_ha_sembrada) : null,
      rinde_estimado_kg_ha: form.rinde_estimado_kg_ha ? Number(form.rinde_estimado_kg_ha) : null,
      rinde_presupuestado_kg_ha: form.rinde_presupuestado_kg_ha ? Number(form.rinde_presupuestado_kg_ha) : null,
      costo_cosecha_usd_ha: form.costo_cosecha_usd_ha ? Number(form.costo_cosecha_usd_ha) : null,
      proveedor_cosecha: form.proveedor_cosecha || null,
      observaciones: form.observaciones || null,
    }

    if (esEdicion && cosechaId) {
      const { error: err } = await supabase.from('sa_cosechas').update(payload).eq('id', cosechaId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('sa_cosechas').insert(payload)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    }

    setSaving(false)
    window.close()
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const costoTotal = Number(form.costo_cosecha_usd_ha || 0) * Number(form.superficie_ha || 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">{esEdicion ? 'Editar cosecha' : 'Cargar cosecha'}</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      <div className="card p-6 space-y-5">

        {/* Fecha y superficie */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Superficie cosechada (ha) *</label>
            <input type="number" name="superficie_ha" value={form.superficie_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            <p className="text-xs text-campo-400 mt-1">Sembrada: {ciclo.sup_sembrada ?? ciclo.hectareas} ha</p>
          </div>
        </div>

        {/* Producción */}
        <div>
          <div className="text-sm font-medium text-campo-700 mb-3">Producción</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-campo-500 mb-1">Producción total (kg)</label>
              <input type="number" name="rinde_kg_total" value={form.rinde_kg_total} onChange={handleChange}
                step="1" placeholder="0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="block text-xs text-campo-500 mb-1">Humedad (%)</label>
              <input type="number" name="humedad_pct" value={form.humedad_pct} onChange={handleChange}
                step="0.1" placeholder="0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="block text-xs text-campo-500 mb-1">Rinde sobre cosechada (kg/ha)</label>
              <input type="number" name="rinde_kg_ha_cosecha" value={form.rinde_kg_ha_cosecha} onChange={handleChange}
                step="0.1" placeholder="Auto-calculado"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 bg-lime-50" />
              <p className="text-xs text-campo-400 mt-1">Se calcula automáticamente</p>
            </div>
            <div>
              <label className="block text-xs text-campo-500 mb-1">Rinde sobre sembrada (kg/ha)</label>
              <input type="number" name="rinde_kg_ha_sembrada" value={form.rinde_kg_ha_sembrada} onChange={handleChange}
                step="0.1" placeholder="Auto-calculado"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 bg-lime-50" />
            </div>
            <div>
              <label className="block text-xs text-campo-500 mb-1">Rinde estimado (kg/ha)</label>
              <input type="number" name="rinde_estimado_kg_ha" value={form.rinde_estimado_kg_ha} onChange={handleChange}
                step="0.1" placeholder="0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
            <div>
              <label className="block text-xs text-campo-500 mb-1">Rinde presupuestado (kg/ha)</label>
              <input type="number" name="rinde_presupuestado_kg_ha" value={form.rinde_presupuestado_kg_ha} onChange={handleChange}
                step="0.1" placeholder="0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            </div>
          </div>
        </div>

        {/* Costo cosecha */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Costo cosecha (USD/ha)
              {form.fecha && form.costo_cosecha_usd_ha && <span className="ml-2 text-xs text-lime-600 font-normal">✓ del tarifario</span>}
            </label>
            <input type="number" name="costo_cosecha_usd_ha" value={form.costo_cosecha_usd_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: USD {fmt(costoTotal)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor cosecha</label>
            <input type="text" name="proveedor_cosecha" value={form.proveedor_cosecha} onChange={handleChange}
              placeholder="Ej: Contratista SA"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar cosecha'}
          </button>
          <button onClick={() => window.close()}
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
