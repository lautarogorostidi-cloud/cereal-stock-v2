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

type Fertilizacion = {
  id: number
  numero: number
  fecha: string | null
  tipo_fertilizante: string | null
  cantidad_ha: number | null
  superficie_ha: number | null
  forma_aplicacion: string | null
  costo_usd_ha: number | null
  costo_servicio_usd_ha: number | null
  proveedor: string | null
  observaciones: string | null
}

type TarifarioItem = {
  insumo: string
  precio_usd: number
  fecha_vigencia: string
}

const FORMAS = ['Voleo', 'Localizado', 'Fertirrigación', 'Foliar']

export default function NuevaFertilizacionPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [fertilizaciones, setFertilizaciones] = useState<Fertilizacion[]>([])
  const [tarifario, setTarifario] = useState<TarifarioItem[]>([])
  const [tarifarioServicios, setTarifarioServicios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  const [form, setForm] = useState({
    fecha: '',
    tipo_fertilizante: '',
    cantidad_ha: '',
    superficie_ha: '',
    forma_aplicacion: '',
    costo_usd_ha: '',
    costo_servicio_usd_ha: '',
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
    const [{ data: cicloData }, { data: fertData }, { data: tarifData }, { data: servData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_fertilizaciones').select('*').eq('ciclo_id', id).order('numero'),
      supabase.from('tarifario_insumos').select('insumo, precio_usd, fecha_vigencia').eq('tipo_insumo', 'Fertilizante'),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
    ])
    setCiclo(cicloData ?? null)
    setFertilizaciones(fertData ?? [])
    setTarifario(tarifData ?? [])
    setTarifarioServicios(servData ?? [])
    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0
    setForm(f => ({ ...f, superficie_ha: supDefault.toString() }))
    setLoading(false)
  }

  function getPrecioVigente(nombre: string, fecha: string): number | null {
    if (!nombre || !fecha) return null
    const registros = tarifario.filter(t => t.insumo === nombre && t.fecha_vigencia <= fecha)
    if (registros.length === 0) {
      const todos = tarifario.filter(t => t.insumo === nombre)
      if (todos.length === 0) return null
      todos.sort((a, b) => a.fecha_vigencia.localeCompare(b.fecha_vigencia))
      return todos[0].precio_usd
    }
    registros.sort((a, b) => b.fecha_vigencia.localeCompare(a.fecha_vigencia))
    return registros[0].precio_usd
  }

  function getCostoServicioVigente(fecha: string): number | null {
    if (!fecha || !ciclo) return null
    const registros = tarifarioServicios.filter(s =>
      s.tipo_servicio?.toLowerCase().includes('fertiliz') &&
      (!s.cultivo || s.cultivo === ciclo.cultivo) &&
      s.vigencia_desde <= fecha
    ).sort((a: any, b: any) => b.vigencia_desde.localeCompare(a.vigencia_desde))
    return registros.length > 0 ? registros[0].costo_usd_ha : null
  }

  function getFertilizantesDisponibles(): string[] {
    return Array.from(new Set(tarifario.map(t => t.insumo))).sort()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => {
      const updated = { ...f, [name]: value }

      // Auto-completar al cambiar fecha
      if (name === 'fecha' && value) {
        const costoServicio = getCostoServicioVigente(value)
        if (costoServicio) updated.costo_servicio_usd_ha = costoServicio.toString()
        // Actualizar precio del fertilizante si ya está cargado
        if (f.tipo_fertilizante) {
          const precio = getPrecioVigente(f.tipo_fertilizante, value)
          if (precio) updated.costo_usd_ha = precio.toString()
        }
      }

      // Auto-completar precio al escribir fertilizante
      if (name === 'tipo_fertilizante' && value && f.fecha) {
        const precio = getPrecioVigente(value, f.fecha)
        if (precio) updated.costo_usd_ha = precio.toString()
      }

      return updated
    })
  }

  function handleFertilizanteSelect(val: string) {
    setForm(f => {
      const updated = { ...f, tipo_fertilizante: val }
      if (val && f.fecha) {
        const precio = getPrecioVigente(val, f.fecha)
        if (precio) updated.costo_usd_ha = precio.toString()
      }
      return updated
    })
  }

  function editarFert(f: Fertilizacion) {
    setEditandoId(f.id)
    setForm({
      fecha: f.fecha ?? '',
      tipo_fertilizante: f.tipo_fertilizante ?? '',
      cantidad_ha: f.cantidad_ha?.toString() ?? '',
      superficie_ha: f.superficie_ha?.toString() ?? '',
      forma_aplicacion: f.forma_aplicacion ?? '',
      costo_usd_ha: f.costo_usd_ha?.toString() ?? '',
      costo_servicio_usd_ha: f.costo_servicio_usd_ha?.toString() ?? '',
      proveedor: f.proveedor ?? '',
      observaciones: f.observaciones ?? '',
    })
  }

  function nuevaFert() {
    setEditandoId(null)
    const supDefault = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0
    setForm({
      fecha: '', tipo_fertilizante: '', cantidad_ha: '',
      superficie_ha: supDefault.toString(),
      forma_aplicacion: '', costo_usd_ha: '',
      costo_servicio_usd_ha: '', proveedor: '', observaciones: '',
    })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar esta fertilización?')) return
    await supabase.from('sa_fertilizaciones').delete().eq('id', id)
    cargar()
    if (editandoId === id) nuevaFert()
  }

  async function handleSubmit() {
    setError(null)
    if (!form.tipo_fertilizante) { setError('El tipo de fertilizante es obligatorio.'); return }
    if (!form.superficie_ha) { setError('La superficie es obligatoria.'); return }
    setSaving(true)

    const payload: any = {
      ciclo_id: Number(ciclo_id),
      fecha: form.fecha || null,
      tipo_fertilizante: form.tipo_fertilizante,
      cantidad_ha: form.cantidad_ha ? Number(form.cantidad_ha) : null,
      superficie_ha: Number(form.superficie_ha),
      forma_aplicacion: form.forma_aplicacion || null,
      costo_usd_ha: form.costo_usd_ha ? Number(form.costo_usd_ha) : null,
      costo_servicio_usd_ha: form.costo_servicio_usd_ha ? Number(form.costo_servicio_usd_ha) : null,
      proveedor: form.proveedor || null,
      observaciones: form.observaciones || null,
    }

    if (editandoId) {
      const { error: err } = await supabase.from('sa_fertilizaciones').update(payload).eq('id', editandoId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    } else {
      const numero = fertilizaciones.length + 1
      const { error: err } = await supabase.from('sa_fertilizaciones').insert({ ...payload, numero })
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    }

    setSaving(false)
    await cargar()
    nuevaFert()
  }

  const fmt = (n: number | null) => n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: 1 }) : '—'
  const fmtUsd = (n: number | null) => n != null && n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '—'
  const fmtFecha = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'
  const costoInsumoTotal = Number(form.cantidad_ha || 0) * Number(form.superficie_ha || 0) * Number(form.costo_usd_ha || 0)
  const costoServicioTotal = Number(form.superficie_ha || 0) * Number(form.costo_servicio_usd_ha || 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  const fertilizantesDisponibles = getFertilizantesDisponibles()

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">Fertilizaciones</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      {fertilizaciones.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Fertilizaciones registradas</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100">
                <th className="text-left px-4 py-2 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-2 font-semibold text-campo-700">Fertilizante</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">kg/ha</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">Sup (ha)</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">Insumo USD/ha</th>
                <th className="text-right px-4 py-2 font-semibold text-campo-700">Serv. USD/ha</th>
                <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {fertilizaciones.map(f => (
                <tr key={f.id} className={`border-b border-campo-50 hover:bg-campo-50/50 ${editandoId === f.id ? 'bg-lime-50' : ''}`}>
                  <td className="px-4 py-2 text-campo-600">{fmtFecha(f.fecha)}</td>
                  <td className="px-4 py-2 font-medium text-campo-900">{f.tipo_fertilizante}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmt(f.cantidad_ha)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmt(f.superficie_ha)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(f.costo_usd_ha)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(f.costo_servicio_usd_ha)}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => editarFert(f)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
                      <button onClick={() => handleBorrar(f.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Borrar</button>
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
          <h2 className="font-semibold text-campo-800">{editandoId ? 'Editar fertilización' : '+ Nueva fertilización'}</h2>
          {editandoId && <button onClick={nuevaFert} className="text-xs text-campo-400 hover:text-campo-700">✕ Cancelar edición</button>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Fertilizante *
              {form.costo_usd_ha && form.tipo_fertilizante && <span className="ml-2 text-xs text-lime-600 font-normal">✓ precio del tarifario</span>}
            </label>
            <BuscadorInsumo
              value={form.tipo_fertilizante}
              opciones={fertilizantesDisponibles}
              placeholder="Ej: Urea, FDA, MAP..."
              onChange={handleFertilizanteSelect}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Cantidad (kg/ha)</label>
            <input type="number" name="cantidad_ha" value={form.cantidad_ha} onChange={handleChange}
              step="0.1" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Superficie (ha) *</label>
            <input type="number" name="superficie_ha" value={form.superficie_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Forma de aplicación</label>
            <select name="forma_aplicacion" value={form.forma_aplicacion} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Sin especificar</option>
              {FORMAS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Costo insumo (USD/kg)</label>
            <input type="number" name="costo_usd_ha" value={form.costo_usd_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoInsumoTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoInsumoTotal)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Costo servicio (USD/ha)
              {form.costo_servicio_usd_ha && form.fecha && <span className="ml-2 text-xs text-lime-600 font-normal">✓ tarifario</span>}
            </label>
            <input type="number" name="costo_servicio_usd_ha" value={form.costo_servicio_usd_ha} onChange={handleChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoServicioTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoServicioTotal)}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor</label>
            <input type="text" name="proveedor" value={form.proveedor} onChange={handleChange}
              placeholder="Ej: Agro SA"
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
            {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar fertilización'}
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

function BuscadorInsumo({ value, opciones, placeholder, onChange }: {
  value: string
  opciones: string[]
  placeholder: string
  onChange: (val: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)

  const filtrados = opciones.filter(o =>
    o.toLowerCase().includes((value || busqueda).toLowerCase())
  ).slice(0, 20)

  return (
    <div className="relative">
      <input
        type="text"
        value={value || busqueda}
        onChange={e => { setBusqueda(e.target.value); onChange(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-campo-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtrados.map(o => (
            <button key={o} onMouseDown={() => { onChange(o); setBusqueda(''); setAbierto(false) }}
              className="w-full text-left px-3 py-2 text-sm text-campo-900 hover:bg-lime-50 hover:text-lime-800">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
