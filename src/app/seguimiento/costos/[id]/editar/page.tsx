'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type Campana = { id: number; nombre: string }

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

type LoteAsesor = {
  lote_id: string
  lote: string
  sup_sembrada: number
  seleccionado: boolean
  ha: string  // editable, default = sup_sembrada (o el valor ya guardado)
}

type Vencimiento = {
  id?: number
  fecha: string
  monto: string
  es_estimado: boolean
  pagado: boolean
}

export default function EditarCostoPage() {
  const supabase = createClient()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

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

  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([])

  // Asesoramiento
  const [asesor, setAsesor] = useState({ kg_soja_ha: '', precio_soja_usd_ton: '' })
  const [lotesAsesor, setLotesAsesor] = useState<LoteAsesor[]>([])
  const [loadingLotesAsesor, setLoadingLotesAsesor] = useState(false)
  // Lotes ya vinculados a este costo (lote_id -> ha guardada), para aplicar una sola vez al cargar
  const lotesGuardadosRef = useRef<Record<string, number> | null>(null)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    const [{ data: camps }, { data: lotes }, { data: costoData }, { data: vencData }, { data: lotesData }] = await Promise.all([
      supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
      supabase.from('lotes').select('establecimiento').eq('activo', true),
      supabase.from('costos_fijos_campo').select('*').eq('id', Number(id)).single(),
      supabase.from('costos_fijos_vencimientos').select('*').eq('costo_id', Number(id)).order('fecha_vencimiento'),
      supabase.from('costos_fijos_lotes').select('lote_id, ha').eq('costo_id', Number(id)),
    ])

    setCampanas(camps ?? [])
    const establs = Array.from(new Set((lotes ?? []).map((l: any) => l.establecimiento))).sort() as string[]
    setEstablecimientos(establs)

    if (costoData) {
      setForm({
        establecimiento: costoData.establecimiento ?? '',
        campana_id: costoData.campana_id?.toString() ?? '',
        tipo: costoData.tipo ?? '',
        periodo: costoData.periodo ?? '',
        observaciones: costoData.observaciones ?? '',
      })
      setAsesor({
        kg_soja_ha: costoData.asesor_kg_soja_ha?.toString() ?? '',
        precio_soja_usd_ton: costoData.asesor_precio_soja_usd_ton?.toString() ?? '',
      })
    }

    if (lotesData && lotesData.length > 0) {
      const mapa: Record<string, number> = {}
      lotesData.forEach((l: any) => { mapa[l.lote_id] = Number(l.ha) })
      lotesGuardadosRef.current = mapa
    } else {
      lotesGuardadosRef.current = null
    }

    setVencimientos((vencData ?? []).map((v: any) => ({
      id: v.id,
      fecha: v.fecha_vencimiento,
      monto: v.monto?.toString() ?? '',
      es_estimado: v.es_estimado ?? true,
      pagado: v.pagado ?? false,
    })))

    setLoading(false)
  }

  const esAsesoramiento = form.tipo === 'asesoramiento'

  // ── ASESORAMIENTO: cargar lotes agrícolas del campo/campaña, aplicando la selección ya guardada (si hay) ──
  useEffect(() => {
    if (!esAsesoramiento || !form.establecimiento || !form.campana_id) {
      setLotesAsesor([])
      return
    }
    cargarLotesAsesor()
  }, [form.tipo, form.establecimiento, form.campana_id])

  async function cargarLotesAsesor() {
    setLoadingLotesAsesor(true)
    const campanaNombre = campanas.find(c => c.id.toString() === form.campana_id)?.nombre

    // Base: TODOS los lotes activos del campo (no solo los que tienen un ciclo cargado esa campaña)
    const { data: lotesData } = await supabase
      .from('lotes')
      .select('id, nombre, hectareas_agricolas')
      .eq('establecimiento', form.establecimiento)
      .eq('activo', true)

    // Superficie realmente sembrada esa campaña, por lote (para sugerir la ha por defecto)
    const { data: ciclosData } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('lote_id, actividad, sup_sembrada, campo, campana')
      .eq('campo', form.establecimiento)
    const supSembradaPorLote: Record<string, number> = {}
    ;(ciclosData ?? [])
      .filter((r: any) => r.campana === campanaNombre && r.actividad === 'agricola')
      .forEach((r: any) => {
        supSembradaPorLote[r.lote_id] = (supSembradaPorLote[r.lote_id] ?? 0) + Number(r.sup_sembrada ?? 0)
      })

    const guardados = lotesGuardadosRef.current
    const lista: LoteAsesor[] = (lotesData ?? [])
      .map((l: any) => {
        const sembrada = supSembradaPorLote[l.id]
        const haPorDefecto = sembrada != null ? sembrada : Number(l.hectareas_agricolas ?? 0)
        if (guardados) {
          const yaVinculado = Object.prototype.hasOwnProperty.call(guardados, l.id)
          return {
            lote_id: l.id,
            lote: l.nombre,
            sup_sembrada: sembrada ?? 0,
            seleccionado: yaVinculado,
            ha: String(yaVinculado ? guardados[l.id] : haPorDefecto),
          }
        }
        return {
          lote_id: l.id,
          lote: l.nombre,
          sup_sembrada: sembrada ?? 0,
          seleccionado: Number(l.hectareas_agricolas ?? 0) > 0,
          ha: String(haPorDefecto),
        }
      })
      .sort((a, b) => a.lote.localeCompare(b.lote))
    lotesGuardadosRef.current = null // aplicar la selección guardada solo la primera vez
    setLotesAsesor(lista)
    setLoadingLotesAsesor(false)
  }

  function toggleLoteAsesor(lote_id: string) {
    setLotesAsesor(prev => prev.map(l => l.lote_id === lote_id ? { ...l, seleccionado: !l.seleccionado } : l))
  }

  function toggleTodosLotesAsesor() {
    const todos = lotesAsesor.every(l => l.seleccionado)
    setLotesAsesor(prev => prev.map(l => ({ ...l, seleccionado: !todos })))
  }

  function handleHaLoteAsesor(lote_id: string, value: string) {
    setLotesAsesor(prev => prev.map(l => l.lote_id === lote_id ? { ...l, ha: value } : l))
  }

  function handleAsesorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setAsesor(a => ({ ...a, [name]: value }))
  }

  const lotesAsesorSeleccionados = lotesAsesor.filter(l => l.seleccionado)
  const haVinculadas = esAsesoramiento ? lotesAsesorSeleccionados.reduce((acc, l) => acc + (Number(l.ha) || 0), 0) : null
  const costoUsdHaAsesor = asesor.kg_soja_ha && asesor.precio_soja_usd_ton
    ? (Number(asesor.kg_soja_ha) * Number(asesor.precio_soja_usd_ton) / 1000)
    : 0
  const montoTotalAsesor = costoUsdHaAsesor && haVinculadas ? costoUsdHaAsesor * haVinculadas : 0

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  function handleVencimiento(idx: number, field: 'fecha' | 'monto', value: string) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function handleVencimientoEstimado(idx: number, value: boolean) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, es_estimado: value } : v))
  }

  function handleVencimientoPagado(idx: number, value: boolean) {
    setVencimientos(prev => prev.map((v, i) => i === idx ? { ...v, pagado: value } : v))
  }

  function agregarVencimiento() {
    setVencimientos(prev => [...prev, { fecha: '', monto: '', es_estimado: true, pagado: false }])
  }

  function eliminarVencimiento(idx: number) {
    setVencimientos(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(null)
    if (!form.establecimiento || !form.campana_id || !form.tipo || !form.periodo) {
      setError('Todos los campos marcados con * son obligatorios.')
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
    if (esAsesoramiento && lotesAsesor.length > 0 && lotesAsesorSeleccionados.length === 0) {
      setError('Seleccioná al menos un lote para vincular el asesoramiento.')
      return
    }

    setSaving(true)

    // Actualizar costo principal
    const montoTotal = vencimientos.reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0)
    const { error: errCosto } = await supabase
      .from('costos_fijos_campo')
      .update({
        establecimiento: form.establecimiento,
        campana_id: Number(form.campana_id),
        tipo: form.tipo,
        periodo: form.periodo,
        monto_total: montoTotal,
        observaciones: form.observaciones || null,
        asesor_kg_soja_ha: esAsesoramiento && asesor.kg_soja_ha ? Number(asesor.kg_soja_ha) : null,
        asesor_precio_soja_usd_ton: esAsesoramiento && asesor.precio_soja_usd_ton ? Number(asesor.precio_soja_usd_ton) : null,
      })
      .eq('id', Number(id))

    if (errCosto) {
      setSaving(false)
      setError(`Error al actualizar: ${errCosto.message}`)
      return
    }

    // Eliminar todos los vencimientos existentes y reinsertarlos
    await supabase.from('costos_fijos_vencimientos').delete().eq('costo_id', Number(id))

    const { error: errVenc } = await supabase
      .from('costos_fijos_vencimientos')
      .insert(vencimientos.map(v => ({
        costo_id: Number(id),
        fecha_vencimiento: v.fecha,
        monto: Number(v.monto),
        pagado: v.pagado,
        es_estimado: v.es_estimado,
      })))

    if (errVenc) {
      setSaving(false)
      setError(`Error al guardar vencimientos: ${errVenc.message}`)
      return
    }

    // Actualizar lotes vinculados (solo aplica a Asesoramiento)
    await supabase.from('costos_fijos_lotes').delete().eq('costo_id', Number(id))
    if (esAsesoramiento && lotesAsesorSeleccionados.length > 0) {
      const { error: errLotes } = await supabase
        .from('costos_fijos_lotes')
        .insert(lotesAsesorSeleccionados.map(l => ({ costo_id: Number(id), lote_id: l.lote_id, ha: Number(l.ha) || l.sup_sembrada })))
      if (errLotes) {
        setSaving(false)
        setError(`El costo se guardó, pero no se pudieron actualizar los lotes vinculados: ${errLotes.message}`)
        return
      }
    }

    setSaving(false)
    router.push('/seguimiento/costos')
  }

  function aplicarMontoCalculado() {
    if (vencimientos.length !== 1 || montoTotalAsesor <= 0) return
    setVencimientos(prev => prev.map((v, i) => i === 0 ? { ...v, monto: montoTotalAsesor.toFixed(2) } : v))
  }

  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const totalVencimientos = vencimientos.reduce((acc, v) => acc + (parseFloat(v.monto) || 0), 0)

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="mb-1">
          <Link href="/seguimiento/costos" className="text-sm text-campo-400 hover:text-campo-700">← Costos</Link>
        </div>
        <h1 className="text-2xl font-bold text-campo-900">Editar costo fijo</h1>
        <p className="text-campo-500 text-sm mt-0.5">Modificá el costo y sus vencimientos</p>
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
          <div>
            <label className="block text-sm font-medium text-campo-700 mb-1">Período *</label>
            <select name="periodo" value={form.periodo} onChange={handleChange}
              className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
              <option value="">Seleccionar período...</option>
              {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* ─── BLOQUE ASESORAMIENTO: recálculo y lotes vinculados ─── */}
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-campo-600">Lotes vinculados</span>
                {lotesAsesor.length > 0 && (
                  <button type="button" onClick={toggleTodosLotesAsesor}
                    className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                    {lotesAsesor.every(l => l.seleccionado) ? 'Quitar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              {!form.establecimiento ? (
                <p className="text-xs text-campo-400">Seleccioná un campo para ver sus lotes.</p>
              ) : loadingLotesAsesor ? (
                <p className="text-xs text-campo-400">Cargando lotes...</p>
              ) : lotesAsesor.length === 0 ? (
                <p className="text-xs text-amber-600">⚠️ No hay cultivos agrícolas sembrados en este campo/campaña.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {lotesAsesor.map(l => (
                    <div key={l.lote_id}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${l.seleccionado ? 'bg-white border-lime-300' : 'bg-white/50 border-campo-100'}`}>
                      <input type="checkbox" checked={l.seleccionado}
                        onChange={() => toggleLoteAsesor(l.lote_id)}
                        className="accent-lime-500 w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-campo-800">{l.lote}</span>
                        {Number(l.ha) !== l.sup_sembrada && (
                          <span className="text-xs text-campo-400 ml-1.5">(sembradas: {l.sup_sembrada.toLocaleString('es-AR')} ha)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <input type="number" value={l.ha}
                          onChange={e => handleHaLoteAsesor(l.lote_id, e.target.value)}
                          disabled={!l.seleccionado}
                          step="0.01" min="0"
                          className="w-20 rounded border border-campo-200 px-2 py-1 text-xs text-campo-900 focus:outline-none focus:ring-1 focus:ring-lime-400 disabled:bg-campo-50 disabled:text-campo-400" />
                        <span className="text-xs text-campo-400">ha</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-campo-400 mt-1">
                Desmarcá los lotes que no correspondan, o corregí la cantidad de ha de un lote si hace falta.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-lime-200">
              <div>
                <div className="text-xs text-campo-500">Costo USD/ha</div>
                <div className="text-lg font-bold text-campo-900">{costoUsdHaAsesor > 0 ? costoUsdHaAsesor.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-campo-500">Ha vinculadas</div>
                <div className="text-lg font-bold text-campo-900">{loadingLotesAsesor ? '...' : haVinculadas != null ? haVinculadas.toLocaleString('es-AR') : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-campo-500">Monto calculado</div>
                <div className="text-lg font-bold text-lime-700">{montoTotalAsesor > 0 ? fmtUsd(montoTotalAsesor) : '—'}</div>
              </div>
            </div>
            {montoTotalAsesor > 0 && vencimientos.length === 1 && (
              <button type="button" onClick={aplicarMontoCalculado}
                className="text-xs text-lime-700 hover:text-lime-600 font-medium">
                ↓ Aplicar este monto al vencimiento
              </button>
            )}
            <p className="text-xs text-campo-400">Este recálculo no se aplica solo — usá el botón de arriba o editá el monto del vencimiento a mano.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea name="observaciones" value={form.observaciones} onChange={handleChange}
            rows={2} placeholder="Notas adicionales..."
            className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none" />
        </div>

        {/* Vencimientos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-campo-700">
              Vencimientos {vencimientos.length > 0 && <span className="text-campo-400 font-normal">— Total: {fmtUsd(totalVencimientos)}</span>}
            </label>
            <button onClick={agregarVencimiento} type="button"
              className="text-xs text-lime-700 hover:text-lime-600 font-medium">
              + Agregar vencimiento
            </button>
          </div>

          <div className="space-y-2">
            {vencimientos.map((v, idx) => (
              <div key={idx} className={`flex gap-2 items-center p-2 rounded-lg ${v.pagado ? 'bg-emerald-50 border border-emerald-200' : v.es_estimado ? 'bg-amber-50 border border-amber-200' : 'bg-campo-50 border border-campo-200'}`}>
                <div className="flex-1">
                  <input type="date" value={v.fecha} onChange={e => handleVencimiento(idx, 'fecha', e.target.value)}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                </div>
                <div className="flex-1">
                  <input type="number" value={v.monto} onChange={e => handleVencimiento(idx, 'monto', e.target.value)}
                    step="0.01" min="0" placeholder="Monto USD"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-white" />
                </div>
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <input type="checkbox" checked={v.es_estimado}
                    onChange={e => handleVencimientoEstimado(idx, e.target.checked)}
                    className="accent-amber-500 w-4 h-4" />
                  <span className={`text-xs font-medium ${v.es_estimado ? 'text-amber-600' : 'text-campo-500'}`}>
                    {v.es_estimado ? '⚠️ Est.' : '✓ Real'}
                  </span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <input type="checkbox" checked={v.pagado}
                    onChange={e => handleVencimientoPagado(idx, e.target.checked)}
                    className="accent-emerald-500 w-4 h-4" />
                  <span className={`text-xs font-medium ${v.pagado ? 'text-emerald-600' : 'text-campo-400'}`}>
                    {v.pagado ? '✓ Pagado' : 'Pagar'}
                  </span>
                </label>
                <button onClick={() => eliminarVencimiento(idx)} type="button"
                  className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
              </div>
            ))}
          </div>


        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors">
            {saving ? 'Guardando...' : 'Guardar cambios'}
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
