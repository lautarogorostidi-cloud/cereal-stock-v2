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

type Hibrido = {
  nombre: string
  sup_ha: string
  cu_usd: string
}

type TarifarioItem = {
  tipo_insumo: string
  insumo: string
  unidad: string | null
  precio_usd: number
  fecha_vigencia: string
}

const SISTEMAS = ['SD', 'SD c/DF', 'SC', 'SC c/DF', 'Laboreo mínimo', 'Otro']
const TIPOS_SEMILLA = ['Inoculada', 'Curada', 'Inoculada - Curada', 'Sin tratamiento']
const TIPOS_SEMILLA_TARIFARIO = ['Soja 1', 'Soja 2', 'Maíz Temprano', 'Maíz Tardío', 'Maíz 2', 'Girasol', 'Trigo', 'Centeno', 'Avena', 'Vicia', 'Vicia + Avena', 'Alfalfa', 'Pastura']

export default function NuevaSiembraPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [esEdicion, setEsEdicion] = useState(false)
  const [siembraId, setSiembraId] = useState<number | null>(null)
  const [tarifario, setTarifario] = useState<TarifarioItem[]>([])
  const [tarifarioServicios, setTarifarioServicios] = useState<any[]>([])

  const [form, setForm] = useState({
    fecha: '',
    sistema: 'SD',
    densidad: '',
    unidad_densidad: 'kg_ha',
    tipo_semilla: '',
    pl_logradas: '',
    costo_servicio_usd_ha: '',
    proveedor_servicio: '',
    fertilizante_1: '',
    fertilizante_1_kg_ha: '',
    fertilizante_1_costo_kg: '',
    fertilizante_2: '',
    fertilizante_2_kg_ha: '',
    fertilizante_2_costo_kg: '',
    observaciones: '',
  })

  const [hibridos, setHibridos] = useState<Hibrido[]>([
    { nombre: '', sup_ha: '', cu_usd: '' }
  ])

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)

    const [{ data: cicloData }, { data: siembraData }, { data: tarifarioData }, { data: serviciosData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_siembras').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('tarifario_insumos').select('tipo_insumo, insumo, unidad, precio_usd, fecha_vigencia'),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
    ])

    setCiclo(cicloData ?? null)
    setTarifario(tarifarioData ?? [])
    setTarifarioServicios(serviciosData ?? [])

    if (siembraData) {
      setEsEdicion(true)
      setSiembraId(siembraData.id)
      setForm({
        fecha: siembraData.fecha ?? '',
        sistema: siembraData.sistema ?? 'SD',
        densidad: siembraData.densidad?.toString() ?? '',
        unidad_densidad: siembraData.unidad_densidad ?? 'kg_ha',
        tipo_semilla: siembraData.tipo_semilla ?? '',
        pl_logradas: siembraData.pl_logradas?.toString() ?? '',
        costo_servicio_usd_ha: siembraData.costo_servicio_usd_ha?.toString() ?? '',
        proveedor_servicio: siembraData.proveedor_servicio ?? '',
        fertilizante_1: siembraData.fertilizante_1 ?? '',
        fertilizante_1_kg_ha: siembraData.fertilizante_1_kg_ha?.toString() ?? '',
        fertilizante_1_costo_kg: siembraData.fertilizante_1_costo_kg?.toString() ?? '',
        fertilizante_2: siembraData.fertilizante_2 ?? '',
        fertilizante_2_kg_ha: siembraData.fertilizante_2_kg_ha?.toString() ?? '',
        fertilizante_2_costo_kg: siembraData.fertilizante_2_costo_kg?.toString() ?? '',
        observaciones: siembraData.observaciones ?? '',
      })
      const hibs: Hibrido[] = []
      if (siembraData.hibrido_1) hibs.push({ nombre: siembraData.hibrido_1, sup_ha: siembraData.sup_hibrido_1?.toString() ?? '', cu_usd: siembraData.cu_hibrido_1?.toString() ?? '' })
      if (siembraData.hibrido_2) hibs.push({ nombre: siembraData.hibrido_2, sup_ha: siembraData.sup_hibrido_2?.toString() ?? '', cu_usd: siembraData.cu_hibrido_2?.toString() ?? '' })
      if (siembraData.hibrido_3) hibs.push({ nombre: siembraData.hibrido_3, sup_ha: siembraData.sup_hibrido_3?.toString() ?? '', cu_usd: siembraData.cu_hibrido_3?.toString() ?? '' })
      if (hibs.length > 0) setHibridos(hibs)
    } else {
      const supTotal = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0
      setHibridos([{ nombre: '', sup_ha: supTotal.toString(), cu_usd: '' }])
      const cultivosMaiz = ['Maíz Temprano', 'Maíz Tardío', 'Maíz 2', 'Girasol']
      if (cicloData && cultivosMaiz.includes(cicloData.cultivo)) {
        setForm(f => ({ ...f, unidad_densidad: 'pl_ha' }))
      }
    }

    setLoading(false)
  }

  // Buscar precio vigente en tarifario
  function getPrecioVigente(nombre: string, fecha: string, tiposInsumo: string[]): number | null {
    if (!nombre || !fecha) return null
    const registros = tarifario.filter(t =>
      t.insumo === nombre &&
      tiposInsumo.includes(t.tipo_insumo) &&
      t.fecha_vigencia <= fecha
    )
    if (registros.length === 0) {
      const todos = tarifario.filter(t => t.insumo === nombre && tiposInsumo.includes(t.tipo_insumo))
      if (todos.length === 0) return null
      todos.sort((a, b) => a.fecha_vigencia.localeCompare(b.fecha_vigencia))
      return todos[0].precio_usd
    }
    registros.sort((a, b) => b.fecha_vigencia.localeCompare(a.fecha_vigencia))
    return registros[0].precio_usd
  }

  // Buscar costo servicio siembra vigente
  function getCostoServicioSiembra(fecha: string): number | null {
    if (!fecha || !ciclo) return null
    const registros = tarifarioServicios.filter(s =>
      s.tipo_servicio?.toLowerCase().includes('siembra') &&
      (!s.cultivo || s.cultivo === ciclo.cultivo) &&
      s.vigencia_desde <= fecha
    ).sort((a: any, b: any) => b.vigencia_desde.localeCompare(a.vigencia_desde))
    return registros.length > 0 ? registros[0].costo_usd_ha : null
  }

  // Productos únicos del tarifario por tipo
  function getProductosTarifario(tiposInsumo: string[]): string[] {
    return Array.from(new Set(
      tarifario.filter(t => tiposInsumo.includes(t.tipo_insumo)).map(t => t.insumo)
    )).sort()
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => {
      const updated = { ...f, [name]: value }

      // Auto-completar costo servicio siembra al cambiar fecha
      if (name === 'fecha' && value) {
        const costoServicio = getCostoServicioSiembra(value)
        if (costoServicio) updated.costo_servicio_usd_ha = costoServicio.toString()

        // Actualizar precios de fertilizantes si ya están cargados
        if (f.fertilizante_1) {
          const precio = getPrecioVigente(f.fertilizante_1, value, ['Fertilizante'])
          if (precio) updated.fertilizante_1_costo_kg = precio.toString()
        }
        if (f.fertilizante_2) {
          const precio = getPrecioVigente(f.fertilizante_2, value, ['Fertilizante'])
          if (precio) updated.fertilizante_2_costo_kg = precio.toString()
        }
      }

      // Auto-completar costo fertilizante al escribir nombre
      if (name === 'fertilizante_1' && value && f.fecha) {
        const precio = getPrecioVigente(value, f.fecha, ['Fertilizante'])
        if (precio) updated.fertilizante_1_costo_kg = precio.toString()
      }
      if (name === 'fertilizante_2' && value && f.fecha) {
        const precio = getPrecioVigente(value, f.fecha, ['Fertilizante'])
        if (precio) updated.fertilizante_2_costo_kg = precio.toString()
      }

      return updated
    })
  }

  function handleHibridoChange(i: number, field: keyof Hibrido, value: string) {
    setHibridos(hs => hs.map((h, idx) => {
      if (idx !== i) return h
      const updated = { ...h, [field]: value }
      // Auto-completar precio al seleccionar híbrido
      if (field === 'nombre' && value && form.fecha) {
        const precio = getPrecioVigente(value, form.fecha, [ciclo?.cultivo ?? ''])
        if (precio) updated.cu_usd = precio.toString()
      }
      return updated
    }))
  }

  // Cálculos
  const densidad = Number(form.densidad || 0)
  const costoSemillaTotal = hibridos.reduce((acc, h) => {
    return acc + Number(h.cu_usd || 0) * densidad * Number(h.sup_ha || 0)
  }, 0)
  const supTotal = hibridos.reduce((acc, h) => acc + Number(h.sup_ha || 0), 0)
  const costoServicioTotal = supTotal * Number(form.costo_servicio_usd_ha || 0)
  const costoFert1 = Number(form.fertilizante_1_kg_ha || 0) * supTotal * Number(form.fertilizante_1_costo_kg || 0)
  const costoFert2 = Number(form.fertilizante_2_kg_ha || 0) * supTotal * Number(form.fertilizante_2_costo_kg || 0)

  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : ''

  async function handleSubmit() {
    setError(null)
    if (!form.fecha) { setError('La fecha es obligatoria.'); return }
    if (!hibridos[0].nombre) { setError('Ingresá al menos un híbrido o variedad.'); return }
    setSaving(true)

    const payload: any = {
      ciclo_id: Number(ciclo_id),
      fecha: form.fecha,
      sistema: form.sistema || null,
      densidad: form.densidad ? Number(form.densidad) : null,
      unidad_densidad: form.unidad_densidad,
      tipo_semilla: form.tipo_semilla || null,
      pl_logradas: form.pl_logradas ? Number(form.pl_logradas) : null,
      costo_servicio_usd_ha: form.costo_servicio_usd_ha ? Number(form.costo_servicio_usd_ha) : null,
      costo_servicio_total: costoServicioTotal || null,
      costo_semilla_total: costoSemillaTotal || null,
      proveedor_servicio: form.proveedor_servicio || null,
      fertilizante_1: form.fertilizante_1 || null,
      fertilizante_1_kg_ha: form.fertilizante_1_kg_ha ? Number(form.fertilizante_1_kg_ha) : null,
      fertilizante_1_costo_kg: form.fertilizante_1_costo_kg ? Number(form.fertilizante_1_costo_kg) : null,
      fertilizante_2: form.fertilizante_2 || null,
      fertilizante_2_kg_ha: form.fertilizante_2_kg_ha ? Number(form.fertilizante_2_kg_ha) : null,
      fertilizante_2_costo_kg: form.fertilizante_2_costo_kg ? Number(form.fertilizante_2_costo_kg) : null,
      observaciones: form.observaciones || null,
      hibrido_1: hibridos[0]?.nombre || null,
      sup_hibrido_1: hibridos[0]?.sup_ha ? Number(hibridos[0].sup_ha) : null,
      cu_hibrido_1: hibridos[0]?.cu_usd ? Number(hibridos[0].cu_usd) : null,
      hibrido_2: hibridos[1]?.nombre || null,
      sup_hibrido_2: hibridos[1]?.sup_ha ? Number(hibridos[1].sup_ha) : null,
      cu_hibrido_2: hibridos[1]?.cu_usd ? Number(hibridos[1].cu_usd) : null,
      hibrido_3: hibridos[2]?.nombre || null,
      sup_hibrido_3: hibridos[2]?.sup_ha ? Number(hibridos[2].sup_ha) : null,
      cu_hibrido_3: hibridos[2]?.cu_usd ? Number(hibridos[2].cu_usd) : null,
    }

    if (esEdicion && siembraId) {
      const { error: err } = await supabase.from('sa_siembras').update(payload).eq('id', siembraId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('sa_siembras').insert(payload)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    }

    setSaving(false)
    window.close()
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  const semillasDisponibles = getProductosTarifario([ciclo.cultivo])
  const fertilizantesDisponibles = getProductosTarifario(['Fertilizante'])

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <button onClick={() => window.close()} className="text-sm text-campo-400 hover:text-campo-700 mb-1">← Volver</button>
        <h1 className="text-2xl font-bold text-campo-900">{esEdicion ? 'Editar siembra' : 'Cargar siembra'}</h1>
        <p className="text-campo-500 text-sm mt-0.5">{ciclo.lote} · {ciclo.campo} · {ciclo.campana} · {ciclo.cultivo}</p>
      </div>

      <div className="card p-6 space-y-5">

        {/* Fecha y Sistema */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label>
            <input type="date" name="fecha" value={form.fecha} onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Sistema</label>
            <select name="sistema" value={form.sistema} onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Densidad */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Densidad</label>
            <input type="number" name="densidad" value={form.densidad} onChange={handleFormChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Unidad densidad</label>
            <div className="flex gap-3 mt-2">
              {[{ value: 'kg_ha', label: 'kg/ha' }, { value: 'pl_ha', label: 'pl/ha' }].map(op => (
                <label key={op.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="unidad_densidad" value={op.value}
                    checked={form.unidad_densidad === op.value} onChange={handleFormChange}
                    className="accent-lime-600" />
                  <span className="text-sm text-campo-700">{op.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Tipo semilla y pl logradas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo de semilla</label>
            <select name="tipo_semilla" value={form.tipo_semilla} onChange={handleFormChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Sin especificar</option>
              {TIPOS_SEMILLA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Plantas logradas (pl/ha)</label>
            <input type="number" name="pl_logradas" value={form.pl_logradas} onChange={handleFormChange}
              step="1" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        {/* Híbridos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-campo-700">Híbridos / Variedades *</label>
            <button onClick={() => setHibridos(hs => [...hs, { nombre: '', sup_ha: '', cu_usd: '' }])}
              className="text-xs text-lime-700 hover:text-lime-600 font-medium">
              + Agregar híbrido
            </button>
          </div>
          <div className="space-y-3">
            {hibridos.map((h, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Híbrido / Variedad</div>}
                  <BuscadorInsumo
                    value={h.nombre}
                    opciones={semillasDisponibles}
                    placeholder="Ej: DM 46 i 20"
                    onChange={val => handleHibridoChange(i, 'nombre', val)}
                  />
                </div>
                <div className="col-span-3">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">Sup. (ha)</div>}
                  <input type="number" value={h.sup_ha} onChange={e => handleHibridoChange(i, 'sup_ha', e.target.value)}
                    step="0.01" placeholder="0"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                </div>
                <div className="col-span-3">
                  {i === 0 && <div className="text-xs text-campo-500 mb-1">
                    USD/kg {h.cu_usd && h.nombre ? <span className="text-lime-600">✓ tarifario</span> : ''}
                  </div>}
                  <input type="number" value={h.cu_usd} onChange={e => handleHibridoChange(i, 'cu_usd', e.target.value)}
                    step="0.01" placeholder="0"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
                </div>
                <div className="col-span-1 flex justify-center">
                  {i === 0 && <div className="text-xs invisible mb-1">x</div>}
                  <button onClick={() => setHibridos(hs => hs.filter((_, idx) => idx !== i))}
                    disabled={hibridos.length <= 1}
                    className="text-campo-300 hover:text-red-400 disabled:opacity-0 text-lg leading-none pb-2">×</button>
                </div>
              </div>
            ))}
          </div>
          {costoSemillaTotal > 0 && (
            <div className="mt-3 pt-3 border-t border-campo-100 text-xs text-campo-500">
              Costo semilla total: <span className="font-semibold text-campo-900">{fmtUsd(costoSemillaTotal)}</span>
              <span className="ml-1">(USD/kg × densidad {densidad} × {supTotal} ha)</span>
            </div>
          )}
        </div>

        {/* Servicio siembra */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">
              Costo servicio siembra (USD/ha)
              {form.costo_servicio_usd_ha && form.fecha && <span className="ml-2 text-xs text-lime-600 font-normal">✓ tarifario</span>}
            </label>
            <input type="number" name="costo_servicio_usd_ha" value={form.costo_servicio_usd_ha} onChange={handleFormChange}
              step="0.01" placeholder="0"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
            {costoServicioTotal > 0 && (
              <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoServicioTotal)}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Proveedor servicio</label>
            <input type="text" name="proveedor_servicio" value={form.proveedor_servicio} onChange={handleFormChange}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
          </div>
        </div>

        {/* Fertilizantes en siembra */}
        <div>
          <div className="text-sm font-medium text-campo-700 mb-3">Fertilizantes en siembra</div>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-campo-500 mb-1">Fertilizante 1</label>
                <BuscadorInsumo
                  value={form.fertilizante_1}
                  opciones={fertilizantesDisponibles}
                  placeholder="Ej: FDA"
                  onChange={val => handleFormChange({ target: { name: 'fertilizante_1', value: val } } as any)}
                />
              </div>
              <div>
                <label className="block text-xs text-campo-500 mb-1">kg/ha</label>
                <input type="number" name="fertilizante_1_kg_ha" value={form.fertilizante_1_kg_ha} onChange={handleFormChange}
                  step="0.1" placeholder="0"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
              </div>
              <div>
                <label className="block text-xs text-campo-500 mb-1">
                  USD/kg {form.fertilizante_1_costo_kg && form.fertilizante_1 ? <span className="text-lime-600">✓</span> : ''}
                </label>
                <input type="number" name="fertilizante_1_costo_kg" value={form.fertilizante_1_costo_kg} onChange={handleFormChange}
                  step="0.01" placeholder="0"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
              </div>
            </div>
            {costoFert1 > 0 && <p className="text-xs text-campo-400">Total fertilizante 1: {fmtUsd(costoFert1)}</p>}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-campo-500 mb-1">Fertilizante 2</label>
                <BuscadorInsumo
                  value={form.fertilizante_2}
                  opciones={fertilizantesDisponibles}
                  placeholder="Ej: Urea"
                  onChange={val => handleFormChange({ target: { name: 'fertilizante_2', value: val } } as any)}
                />
              </div>
              <div>
                <label className="block text-xs text-campo-500 mb-1">kg/ha</label>
                <input type="number" name="fertilizante_2_kg_ha" value={form.fertilizante_2_kg_ha} onChange={handleFormChange}
                  step="0.1" placeholder="0"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
              </div>
              <div>
                <label className="block text-xs text-campo-500 mb-1">
                  USD/kg {form.fertilizante_2_costo_kg && form.fertilizante_2 ? <span className="text-lime-600">✓</span> : ''}
                </label>
                <input type="number" name="fertilizante_2_costo_kg" value={form.fertilizante_2_costo_kg} onChange={handleFormChange}
                  step="0.01" placeholder="0"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400" />
              </div>
            </div>
            {costoFert2 > 0 && <p className="text-xs text-campo-400">Total fertilizante 2: {fmtUsd(costoFert2)}</p>}
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleFormChange}
            rows={3} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Guardar siembra'}
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

// Componente buscador con autocomplete
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
