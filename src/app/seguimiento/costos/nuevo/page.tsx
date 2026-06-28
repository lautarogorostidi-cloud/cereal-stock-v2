'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Campana = { id: number; nombre: string }

type CicloOpcion = {
  ciclo_id: number
  lote: string
  cultivo: string
  sup_sembrada: number
  seleccionado: boolean
  ha_aseguradas: string  // editable, default = sup_sembrada
}

const TIPOS = [
  { value: 'arrendamiento', label: 'Arrendamiento' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'indemnizacion_seguro', label: 'Indemnización seguro' },
  { value: 'asesoramiento', label: 'Asesoramiento' },
  { value: 'impuesto', label: 'Impuesto' },
  { value: 'costo_oportunidad', label: 'Costo de oportunidad' },
  { value: 'otro', label: 'Otro' },
]

const PERIODOS = [
  { value: 'mensual', label: 'Mensual', cuotas: 12 },
  { value: 'trimestral', label: 'Trimestral', cuotas: 4 },
  { value: 'cuatrimestral', label: 'Cuatrimestral', cuotas: 3 },
  { value: 'semestral', label: 'Semestral', cuotas: 2 },
  { value: 'anual', label: 'Anual', cuotas: 1 },
]

const CULTIVOS_ASESORAMIENTO = ['Trigo', 'Soja 1', 'Soja 2', 'Maíz Temprano', 'Maíz 1', 'Maíz 2', 'Maíz Tardío', 'Girasol']

// Tipos que van al sistema viejo (sa_costos_fijos) por ciclo, con selector de lotes
const TIPOS_POR_CICLO = ['seguro', 'indemnizacion_seguro']
// Mapeo al tipo que acepta sa_costos_fijos (constraint)
const TIPO_SA_COSTOS: Record<string, string> = {
  seguro: 'seguro',
  indemnizacion_seguro: 'indemnizacion_seguro',
}

type Vencimiento = {
  fecha: string
  monto: string
  es_estimado: boolean
}

export default function NuevoCostoPage() {
  const supabase = createClient()
  const router = useRouter()

  const [campanas, setCampanas] = useState<Campana[]>([])
  const [establecimientos, setEstablecimientos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    establecimiento: '',
    campana_id: '',
    tipo: '',
    periodo: '',
    observaciones: '',
  })

  // Asesoramiento
  const [asesor, setAsesor] = useState({ kg_soja_ha: '', precio_soja_usd_ton: '' })
  const [haSembradas, setHaSembradas] = useState<number | null>(null)
  const [loadingHa, setLoadingHa] = useState(false)

  // Seguro / Indemnización (por ciclo)
  const [ciclosDisponibles, setCiclosDisponibles] = useState<CicloOpcion[]>([])
  const [loadingCiclos, setLoadingCiclos] = useState(false)
  const [montoUsdHa, setMontoUsdHa] = useState('')

  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([])

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: camps }, { data: lotes }] = await Promise.all([
      supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
      supabase.from('lotes').select('establecimiento').eq('activo', true),
    ])
    setCampanas(camps ?? [])
    const establs = Array.from(new Set((lotes ?? []).map((l: any) => l.establecimiento))).sort() as string[]
    setEstablecimientos(establs)
    if (camps && camps.length > 0) setForm(f => ({ ...f, campana_id: camps[0].id.toString() }))
    setLoading(false)
  }

  const esAsesoramiento = form.tipo === 'asesoramiento'
  const esPorCiclo = TIPOS_POR_CICLO.includes(form.tipo)
  const esIndemnizacion = form.tipo === 'indemnizacion_seguro'

  // ── ASESORAMIENTO: calcular ha sembradas agrícolas ──
  useEffect(() => {
    if (!esAsesoramiento || !form.establecimiento || !form.campana_id) {
      setHaSembradas(null)
      return
    }
    calcularHaSembradas()
  }, [form.tipo, form.establecimiento, form.campana_id])

  async function calcularHaSembradas() {
    setLoadingHa(true)
    const { data } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('sup_sembrada, cultivo, campo, campana')
      .eq('campo', form.establecimiento)
    const campanaNombre = campanas.find(c => c.id.toString() === form.campana_id)?.nombre
    const total = (data ?? [])
      .filter((r: any) => r.campana === campanaNombre && CULTIVOS_ASESORAMIENTO.includes(r.cultivo))
      .reduce((acc: number, r: any) => acc + Number(r.sup_sembrada ?? 0), 0)
    setHaSembradas(total)
    setLoadingHa(false)
  }

  const costoUsdHa = asesor.kg_soja_ha && asesor.precio_soja_usd_ton
    ? (Number(asesor.kg_soja_ha) * Number(asesor.precio_soja_usd_ton) / 1000)
    : 0
  const montoTotalAsesor = costoUsdHa && haSembradas ? costoUsdHa * haSembradas : 0

  useEffect(() => {
    if (!esAsesoramiento) return
    if (montoTotalAsesor > 0 && form.campana_id) {
      const campanaNombre = campanas.find(c => c.id.toString() === form.campana_id)?.nombre
      let anioVenc = new Date().getFullYear()
      if (campanaNombre && campanaNombre.includes('-')) anioVenc = 2000 + parseInt(campanaNombre.split('-')[1])
      setVencimientos([{ fecha: `${anioVenc}-08-31`, monto: montoTotalAsesor.toFixed(2), es_estimado: true }])
    }
  }, [montoTotalAsesor, form.tipo, form.campana_id])

  // ── SEGURO/INDEMNIZACIÓN: cargar ciclos del campo ──
  useEffect(() => {
    if (!esPorCiclo || !form.establecimiento || !form.campana_id) {
      setCiclosDisponibles([])
      return
    }
    cargarCiclos()
  }, [form.tipo, form.establecimiento, form.campana_id])

  async function cargarCiclos() {
    setLoadingCiclos(true)
    const campanaNombre = campanas.find(c => c.id.toString() === form.campana_id)?.nombre
    const { data } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('ciclo_id, lote, cultivo, sup_sembrada, campo, campana')
      .eq('campo', form.establecimiento)
    const opciones: CicloOpcion[] = (data ?? [])
      .filter((r: any) => r.campana === campanaNombre)
      .map((r: any) => ({
        ciclo_id: r.ciclo_id,
        lote: r.lote,
        cultivo: r.cultivo,
        sup_sembrada: Number(r.sup_sembrada ?? 0),
        seleccionado: false,
        ha_aseguradas: String(r.sup_sembrada ?? 0),
      }))
      .sort((a: CicloOpcion, b: CicloOpcion) => a.lote.localeCompare(b.lote))
    setCiclosDisponibles(opciones)
    setLoadingCiclos(false)
  }

  function toggleCiclo(ciclo_id: number) {
    setCiclosDisponibles(prev => prev.map(c =>
      c.ciclo_id === ciclo_id ? { ...c, seleccionado: !c.seleccionado } : c
    ))
  }

  function toggleTodos() {
    const todosSeleccionados = ciclosDisponibles.every(c => c.seleccionado)
    setCiclosDisponibles(prev => prev.map(c => ({ ...c, seleccionado: !todosSeleccionados })))
  }

  function handleHaAseguradas(ciclo_id: number, value: string) {
    setCiclosDisponibles(prev => prev.map(c =>
      c.ciclo_id === ciclo_id ? { ...c, ha_aseguradas: value } : c
    ))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (name === 'tipo') {
      // Limpiar estados según el tipo nuevo
      setAsesor({ kg_soja_ha: '', precio_soja_usd_ton: '' })
      setHaSembradas(null)
      setCiclosDisponibles([])
      setMontoUsdHa('')
      setVencimientos([])
      if (value === 'asesoramiento') setForm(f => ({ ...f, periodo: 'anual' }))
      if (TIPOS_POR_CICLO.includes(value)) setForm(f => ({ ...f, periodo: 'anual' }))
    }
  }

  function handleAsesorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setAsesor(a => ({ ...a, [name]: value }))
  }

  function handleVencimiento(idx: number, field: 'fecha' | 'monto', value: string) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }
  function agregarVencimiento() {
    setVencimientos(prev => [...prev, { fecha: '', monto: '', es_estimado: true }])
  }
  function handleVencimientoEstimado(idx: number, value: boolean) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, es_estimado: value } : v))
  }
  function eliminarVencimiento(idx: number) {
    setVencimientos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── GUARDAR ──
  async function handleSubmit() {
    setError(null)

    if (!form.establecimiento || !form.campana_id || !form.tipo) {
      setError('Campo, campaña y tipo son obligatorios.')
      return
    }

    // ─── SEGURO / INDEMNIZACIÓN: guardar en sa_costos_fijos por ciclo ───
    if (esPorCiclo) {
      const seleccionados = ciclosDisponibles.filter(c => c.seleccionado)
      if (seleccionados.length === 0) {
        setError('Seleccioná al menos un lote/cultivo.')
        return
      }
      if (!montoUsdHa || Number(montoUsdHa) <= 0) {
        setError('Ingresá el monto en USD/ha.')
        return
      }

      setSaving(true)

      // Para indemnización, el monto se guarda NEGATIVO
      const signo = esIndemnizacion ? -1 : 1
      const tipoSa = TIPO_SA_COSTOS[form.tipo]

      const registros = seleccionados.map(c => {
        const ha = Number(c.ha_aseguradas) || c.sup_sembrada
        const costoHa = signo * Number(montoUsdHa)
        return {
          ciclo_id: c.ciclo_id,
          tipo: tipoSa,
          costo_usd_ha: costoHa,
          costo_total_usd: costoHa * ha,
        }
      })

      const { error: errSa } = await supabase.from('sa_costos_fijos').insert(registros)
      setSaving(false)
      if (errSa) {
        setError(`Error al guardar: ${errSa.message}`)
        return
      }
      router.push('/seguimiento/costos')
      return
    }

    // ─── ARRENDAMIENTO / ASESORAMIENTO / OTROS: sistema nuevo costos_fijos_campo ───
    if (!form.periodo) {
      setError('El período es obligatorio.')
      return
    }
    if (vencimientos.length === 0) {
      setError('Agregá al menos un vencimiento.')
      return
    }
    if (vencimientos.some(v => !v.fecha || !v.monto)) {
      setError('Completá fecha y monto de todos los vencimientos.')
      return
    }

    setSaving(true)

    let obs = form.observaciones || null
    if (esAsesoramiento && costoUsdHa > 0) {
      const detalle = `Asesoramiento ${asesor.kg_soja_ha} kg soja/ha · soja ${asesor.precio_soja_usd_ton} USD/tn = ${costoUsdHa.toFixed(2)} USD/ha × ${haSembradas} ha sembradas`
      obs = obs ? `${obs} · ${detalle}` : detalle
    }

    const montoTotal = vencimientos.reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0)
    const { data: costo, error: errCosto } = await supabase
      .from('costos_fijos_campo')
      .insert({
        establecimiento: form.establecimiento,
        campana_id: Number(form.campana_id),
        tipo: form.tipo,
        periodo: form.periodo,
        monto_total: montoTotal,
        observaciones: obs,
      })
      .select('id')
      .single()

    if (errCosto) {
      setSaving(false)
      setError(`Error al guardar: ${errCosto.message}`)
      return
    }

    const { error: errVenc } = await supabase
      .from('costos_fijos_vencimientos')
      .insert(vencimientos.map(v => ({
        costo_id: costo.id,
        fecha_vencimiento: v.fecha,
        monto: Number(v.monto),
        pagado: false,
        es_estimado: v.es_estimado,
      })))

    setSaving(false)
    if (errVenc) {
      setError(`Error al guardar vencimientos: ${errVenc.message}`)
      return
    }
    router.push('/seguimiento/costos')
  }

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const totalVencimientos = vencimientos.reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0)

  // Total estimado del seguro/indemnización seleccionado
  const seleccionados = ciclosDisponibles.filter(c => c.seleccionado)
  const totalPorCiclo = seleccionados.reduce((acc, c) => {
    const ha = Number(c.ha_aseguradas) || c.sup_sembrada
    return acc + (Number(montoUsdHa) || 0) * ha
  }, 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="mb-1">
          <Link href="/seguimiento/costos" className="text-sm text-campo-400 hover:text-campo-700">← Costos</Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Nuevo costo fijo</h1>
        <p className="text-campo-500 text-sm mt-0.5">Registrá un costo fijo y sus vencimientos</p>
      </div>

      <div className="card p-6 space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Campo *</label>
            <select name="establecimiento" value={form.establecimiento} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar campo...</option>
              {establecimientos.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
            <select name="campana_id" value={form.campana_id} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Tipo *</label>
            <select name="tipo" value={form.tipo} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar tipo...</option>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {!esPorCiclo && (
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Período *</label>
              <select name="periodo" value={form.periodo} onChange={handleChange}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
                <option value="">Seleccionar período...</option>
                {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ─── BLOQUE SEGURO / INDEMNIZACIÓN: selector de ciclos ─── */}
        {esPorCiclo && (
          <div className={`rounded-lg border p-4 space-y-3 ${esIndemnizacion ? 'border-emerald-200 bg-emerald-50/50' : 'border-purple-200 bg-purple-50/50'}`}>
            <div className={`text-sm font-semibold ${esIndemnizacion ? 'text-emerald-800' : 'text-purple-800'}`}>
              {esIndemnizacion ? 'Indemnización de seguro por lote' : 'Seguro por lote'}
            </div>

            <div>
              <label className="block text-xs font-medium text-campo-600 mb-1">
                Monto {esIndemnizacion ? 'indemnización' : 'seguro'} (USD/ha)
              </label>
              <input type="number" value={montoUsdHa} onChange={e => setMontoUsdHa(e.target.value)}
                step="0.01" min="0" placeholder="Ej: 10.50"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
              {esIndemnizacion && (
                <p className="text-xs text-emerald-600 mt-1">Se guardará como negativo (reduce el costo total del ciclo).</p>
              )}
            </div>

            {!form.establecimiento ? (
              <p className="text-xs text-campo-400">Seleccioná un campo para ver sus lotes.</p>
            ) : loadingCiclos ? (
              <p className="text-xs text-campo-400">Cargando lotes...</p>
            ) : ciclosDisponibles.length === 0 ? (
              <p className="text-xs text-amber-600">No hay ciclos en este campo/campaña.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-campo-600">Seleccioná lotes / cultivos</span>
                  <button type="button" onClick={toggleTodos}
                    className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                    {ciclosDisponibles.every(c => c.seleccionado) ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {ciclosDisponibles.map(c => (
                    <div key={c.ciclo_id}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${c.seleccionado ? 'bg-white border-lime-300' : 'bg-white/50 border-campo-100'}`}>
                      <input type="checkbox" checked={c.seleccionado}
                        onChange={() => toggleCiclo(c.ciclo_id)}
                        className="accent-lime-500 w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-campo-800">{c.lote}</span>
                        <span className="text-xs text-campo-500 ml-2">{c.cultivo}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-campo-400">ha:</span>
                        <input type="number" value={c.ha_aseguradas}
                          onChange={e => handleHaAseguradas(c.ciclo_id, e.target.value)}
                          disabled={!c.seleccionado}
                          step="0.01" min="0"
                          className="w-20 rounded border border-campo-200 px-2 py-1 text-xs text-campo-900 focus:outline-none focus:ring-1 focus:ring-lime-400 disabled:bg-campo-50 disabled:text-campo-400" />
                      </div>
                    </div>
                  ))}
                </div>

                {seleccionados.length > 0 && (
                  <div className="pt-2 border-t border-campo-200 text-xs text-campo-600 space-y-0.5">
                    <div>
                      {seleccionados.length} lote(s) · {seleccionados.reduce((acc, c) => acc + (Number(c.ha_aseguradas) || c.sup_sembrada), 0).toLocaleString('es-AR')} ha aseguradas
                    </div>
                    {montoUsdHa && (
                      <div>
                        Total {esIndemnizacion ? 'indemnización' : 'seguro'}:{' '}
                        <span className={`font-semibold ${esIndemnizacion ? 'text-emerald-700' : 'text-purple-700'}`}>
                          {esIndemnizacion ? '−' : ''}{fmtUsd(totalPorCiclo)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── BLOQUE ASESORAMIENTO ─── */}
        {esAsesoramiento && (
          <div className="rounded-lg border border-lime-200 bg-lime-50/50 p-4 space-y-3">
            <div className="text-sm font-semibold text-lime-800">Cálculo del asesoramiento</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Kg de soja / ha</label>
                <input type="number" name="kg_soja_ha" value={asesor.kg_soja_ha} onChange={handleAsesorChange}
                  step="0.01" min="0" placeholder="40"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-campo-600 mb-1">Precio soja (USD/ton)</label>
                <input type="number" name="precio_soja_usd_ton" value={asesor.precio_soja_usd_ton} onChange={handleAsesorChange}
                  step="0.01" min="0" placeholder="317.73"
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-lime-200">
              <div>
                <div className="text-xs text-campo-500">Costo USD/ha</div>
                <div className="text-lg font-bold text-campo-900">{costoUsdHa > 0 ? costoUsdHa.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-campo-500">Ha sembradas agríc.</div>
                <div className="text-lg font-bold text-campo-900">{loadingHa ? '...' : haSembradas != null ? haSembradas.toLocaleString('es-AR') : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-campo-500">Monto total</div>
                <div className="text-lg font-bold text-lime-700">{montoTotalAsesor > 0 ? fmtUsd(montoTotalAsesor) : '—'}</div>
              </div>
            </div>
            {haSembradas === 0 && (
              <p className="text-xs text-amber-600">⚠️ No hay cultivos agrícolas sembrados en este campo/campaña.</p>
            )}
            <p className="text-xs text-campo-400">El vencimiento se genera automáticamente al 31/08 (fin de campaña).</p>
          </div>
        )}

        {/* Observaciones - solo para sistema nuevo (no por ciclo) */}
        {!esPorCiclo && (
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
            <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
              rows={2} placeholder="Notas adicionales..."
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
          </div>
        )}

        {/* Vencimientos - solo para sistema nuevo (no por ciclo) */}
        {!esPorCiclo && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-campo-700">
                Vencimientos {vencimientos.length > 0 && <span className="text-campo-400 font-normal">— Total: {fmtUsd(totalVencimientos)}</span>}
              </label>
              {!esAsesoramiento && (
                <button onClick={agregarVencimiento} type="button"
                  className="text-xs text-lime-700 hover:text-lime-600 font-medium">+ Agregar vencimiento</button>
              )}
            </div>

            {vencimientos.length === 0 && (
              <p className="text-xs text-campo-400">
                {esAsesoramiento
                  ? 'Completá los kg de soja/ha y el precio para generar el vencimiento automáticamente.'
                  : 'Agregá los vencimientos manualmente con el botón de arriba.'}
              </p>
            )}

            <div className="space-y-2">
              {vencimientos.map((v, idx) => (
                <div key={idx} className={`flex gap-3 items-center p-2 rounded-lg ${v.es_estimado ? 'bg-amber-50 border border-amber-200' : 'bg-campo-50 border border-campo-200'}`}>
                  <div className="flex-1">
                    <input type="date" value={v.fecha} onChange={e => handleVencimiento(idx, 'fecha', e.target.value)}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                  </div>
                  <div className="flex-1">
                    <input type="number" value={v.monto} onChange={e => handleVencimiento(idx, 'monto', e.target.value)}
                      step="0.01" min="0" placeholder="Monto USD"
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input type="checkbox" checked={v.es_estimado}
                      onChange={e => handleVencimientoEstimado(idx, e.target.checked)}
                      className="accent-amber-500 w-4 h-4" />
                    <span className={`text-xs font-medium ${v.es_estimado ? 'text-amber-600' : 'text-campo-500'}`}>
                      {v.es_estimado ? '⚠️ Estimado' : '✓ Real'}
                    </span>
                  </label>
                  <button onClick={() => eliminarVencimiento(idx)} type="button"
                    className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Guardar costo'}
          </button>
          <Link href="/seguimiento/costos"
            className="px-4 py-2.5 text-sm font-medium text-campo-600 hover:text-campo-900 hover:bg-campo-100 rounded-lg transition-colors">
            Cancelar
          </Link>
        </div>

      </div>
    </div>
  )
}
