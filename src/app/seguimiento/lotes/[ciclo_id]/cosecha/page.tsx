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

// Datos uuid del ciclo para vincular con stock de cereal
type CicloIds = {
  lote_id: string | null
  cultivo_id: string | null
  campana_nombre: string | null
}

export default function NuevaCosechaPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<CicloInfo | null>(null)
  const [cicloIds, setCicloIds] = useState<CicloIds | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [esEdicion, setEsEdicion] = useState(false)
  const [cosechaId, setCosechaId] = useState<number | null>(null)
  const [clientes, setClientes] = useState<{id: string; razon_social: string}[]>([])
  const [destinos, setDestinos] = useState<{id: string; ubicacion: 'campo'|'acopio'; acopio_cliente_id: string; toneladas: string}[]>([
    {id: '1', ubicacion: 'campo', acopio_cliente_id: '', toneladas: ''}
  ])
  const [showNuevoAcopio, setShowNuevoAcopio] = useState<string | null>(null)
  const [nuevoAcopioNombre, setNuevoAcopioNombre] = useState('')
  const [nuevoAcopioCuit, setNuevoAcopioCuit] = useState('')
  const [guardandoAcopio, setGuardandoAcopio] = useState(false)
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
    const [{ data: cicloData }, { data: cosechaData }, { data: servicios }, { data: cicloRaw }, { data: clientesData }] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('lote, campo, campana, cultivo, sup_sembrada, hectareas').eq('ciclo_id', id).single(),
      supabase.from('sa_cosechas').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('tarifario_servicios').select('*').order('vigencia_desde', { ascending: false }),
      supabase.from('sa_ciclos').select('lote_id, cultivo_id, campana_id').eq('id', id).single(),
      supabase.from('clientes').select('id, razon_social').eq('activo', true).order('razon_social'),
    ])
    setCiclo(cicloData ?? null)
    setTarifarioServicios(servicios ?? [])

    // Guardar los uuid del ciclo para la vinculación con cereal
    setCicloIds({
      lote_id: cicloRaw?.lote_id ?? null,
      cultivo_id: cicloRaw?.cultivo_id ?? null,
      campana_nombre: cicloData?.campana ?? null,
    })

    const supDefault = cicloData?.sup_sembrada ?? cicloData?.hectareas ?? 0

    setClientes(clientesData ?? [])

    // Cargar ubicación si existe cosecha previa
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

      if (name === 'rinde_kg_total' || name === 'superficie_ha') {
        const total = Number(name === 'rinde_kg_total' ? value : f.rinde_kg_total)
        const sup = Number(name === 'superficie_ha' ? value : f.superficie_ha)
        if (total > 0 && sup > 0) {
          updated.rinde_kg_ha_cosecha = (total / sup).toFixed(1)
        }
      }

      if (name === 'rinde_kg_total') {
        const total = Number(value)
        const supSembrada = ciclo?.sup_sembrada ?? ciclo?.hectareas ?? 0
        if (total > 0 && supSembrada > 0) {
          updated.rinde_kg_ha_sembrada = (total / supSembrada).toFixed(1)
        }
      }

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

  // ── Vinculación con stock de cereal ──
  async function sincronizarStockCereal() {
    if (!cicloIds || !cicloIds.cultivo_id || !cicloIds.campana_nombre) return
    const kgTotal = form.rinde_kg_total ? Number(form.rinde_kg_total) : 0

    // Buscar el uuid de la campaña en la tabla de cereal (campanias, por nombre)
    const { data: campCereal } = await supabase
      .from('campanias')
      .select('id')
      .eq('nombre', cicloIds.campana_nombre)
      .maybeSingle()

    // Borrar siempre los movimientos anteriores de esta cosecha
    await supabase.from('movimientos_cereal').delete().eq('ciclo_id', Number(ciclo_id)).eq('tipo', 'cosecha')
    await supabase.from('cosecha_destinos').delete().eq('ciclo_id', Number(ciclo_id))

    // Si no hay kg o no se pudo mapear la campaña, no creamos movimiento nuevo
    if (kgTotal <= 0 || !campCereal?.id) return

    // Obtener el usuario logueado
    const { data: userData } = await supabase.auth.getUser()
    const usuarioId = userData?.user?.id ?? null
    const fecha = form.fecha || new Date().toISOString().split('T')[0]

    // Determinar destinos: si hay destinos configurados usarlos, si no usar campo por defecto
    const destinosValidos = destinos.filter(d => d.toneladas && Number(d.toneladas) > 0)
    const totalDestinosTn = destinosValidos.reduce((s, d) => s + Number(d.toneladas), 0)

    if (destinosValidos.length > 0 && totalDestinosTn > 0) {
      // Insertar un movimiento por cada destino
      for (const dest of destinosValidos) {
        const tn = Number(dest.toneladas)
        await supabase.from('movimientos_cereal').insert({
          tipo: 'cosecha', fecha,
          campania_id: campCereal.id,
          cultivo_id: cicloIds.cultivo_id,
          lote_id: cicloIds.lote_id,
          toneladas: tn,
          humedad: form.humedad_pct ? Number(form.humedad_pct) : null,
          ciclo_id: Number(ciclo_id),
          usuario_id: usuarioId,
          ubicacion: dest.ubicacion,
          acopio_cliente_id: dest.ubicacion === 'acopio' && dest.acopio_cliente_id ? dest.acopio_cliente_id : null,
          descripcion_movimiento: `Cosecha desde seguimiento — ${ciclo?.lote} ${ciclo?.cultivo} ${ciclo?.campana}${dest.ubicacion === 'acopio' ? ' → Acopio' : ' → Campo'}`,
        })
      }
      // Guardar en cosecha_destinos para referencia
      await supabase.from('cosecha_destinos').insert(
        destinosValidos.map(d => ({
          ciclo_id: Number(ciclo_id),
          ubicacion: d.ubicacion,
          acopio_cliente_id: d.ubicacion === 'acopio' && d.acopio_cliente_id ? d.acopio_cliente_id : null,
          toneladas: Number(d.toneladas),
          usuario_id: usuarioId,
        }))
      )
    } else {
      // Sin destinos configurados: todo al campo
      const toneladas = kgTotal / 1000
      await supabase.from('movimientos_cereal').insert({
        tipo: 'cosecha', fecha,
        campania_id: campCereal.id,
        cultivo_id: cicloIds.cultivo_id,
        lote_id: cicloIds.lote_id,
        toneladas,
        humedad: form.humedad_pct ? Number(form.humedad_pct) : null,
        ciclo_id: Number(ciclo_id),
        usuario_id: usuarioId,
        ubicacion: 'campo',
        acopio_cliente_id: null,
        descripcion_movimiento: `Cosecha desde seguimiento — ${ciclo?.lote} ${ciclo?.cultivo} ${ciclo?.campana}`,
      })
    }
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

    // Sincronizar con el stock de cereal (no bloquea si falla)
    try {
      await sincronizarStockCereal()
    } catch (e) {
      console.error('Error al sincronizar stock de cereal:', e)
    }

    setSaving(false)
    window.close()
  }

  async function handleCrearAcopio(destinoId: string) {
    if (!nuevoAcopioNombre.trim()) return
    setGuardandoAcopio(true)
    const { data, error } = await supabase.from('clientes').insert({
      razon_social: nuevoAcopioNombre.trim(),
      cuit: nuevoAcopioCuit.trim() || null,
      tipo: 'acopio',
      activo: true,
    }).select('id, razon_social').single()
    if (!error && data) {
      setClientes(prev => [...prev, data].sort((a, b) => a.razon_social.localeCompare(b.razon_social)))
      setDestinos(prev => prev.map(d => d.id === destinoId ? {...d, acopio_cliente_id: data.id} : d))
      setShowNuevoAcopio(null)
      setNuevoAcopioNombre('')
      setNuevoAcopioCuit('')
    }
    setGuardandoAcopio(false)
  }

  function agregarDestino() {
    setDestinos(prev => [...prev, {id: Date.now().toString(), ubicacion: 'campo', acopio_cliente_id: '', toneladas: ''}])
  }

  function quitarDestino(id: string) {
    setDestinos(prev => prev.filter(d => d.id !== id))
  }

  function actualizarDestino(id: string, campo: string, valor: string) {
    setDestinos(prev => prev.map(d => d.id === id ? {...d, [campo]: valor} : d))
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const costoTotal = Number(form.costo_cosecha_usd_ha || 0) * Number(form.superficie_ha || 0)
  const toneladas = form.rinde_kg_total ? Number(form.rinde_kg_total) / 1000 : 0

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

        <div>
          <div className="text-sm font-medium text-campo-700 mb-3">Producción</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-campo-500 mb-1">Producción total (kg)</label>
              <input type="number" name="rinde_kg_total" value={form.rinde_kg_total} onChange={handleChange}
                step="1" placeholder="0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
              {toneladas > 0 && (
                <p className="text-xs text-lime-600 mt-1">= {toneladas.toLocaleString('es-AR', { maximumFractionDigits: 2 })} tn → suma al stock de cereal</p>
              )}
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

        {/* Distribución de destinos */}
        {toneladas > 0 && (
          <div className="rounded-lg border border-campo-200 bg-campo-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-campo-700">Distribución de destinos</div>
              <div className="text-xs text-campo-500">
                Total: {destinos.reduce((s,d) => s + (Number(d.toneladas)||0), 0).toLocaleString('es-AR', {maximumFractionDigits:3})} / {toneladas.toLocaleString('es-AR', {maximumFractionDigits:3})} tn
              </div>
            </div>

            {destinos.map((dest, idx) => (
              <div key={dest.id} className="rounded-lg border border-campo-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-campo-600">Destino {idx + 1}</span>
                  {destinos.length > 1 && (
                    <button type="button" onClick={() => quitarDestino(dest.id)}
                      className="text-xs text-red-400 hover:text-red-600">× Quitar</button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => actualizarDestino(dest.id, 'ubicacion', 'campo')}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${dest.ubicacion === 'campo' ? 'border-campo-700 bg-campo-700 text-white' : 'border-campo-200 text-campo-700 hover:bg-campo-100'}`}>
                    🌾 Campo / bolsa
                  </button>
                  <button type="button" onClick={() => actualizarDestino(dest.id, 'ubicacion', 'acopio')}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${dest.ubicacion === 'acopio' ? 'border-blue-600 bg-blue-600 text-white' : 'border-campo-200 text-campo-700 hover:bg-campo-100'}`}>
                    🏭 Acopio
                  </button>
                </div>
                <div>
                  <label className="text-xs text-campo-500 mb-1 block">Toneladas</label>
                  <input type="number" min={0} step="0.001"
                    value={dest.toneladas}
                    onChange={e => actualizarDestino(dest.id, 'toneladas', e.target.value)}
                    placeholder="0.000"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" />
                </div>
                {dest.ubicacion === 'acopio' && (
                  <div className="space-y-2">
                    {showNuevoAcopio !== dest.id ? (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-campo-500">Acopio</label>
                          <button type="button" onClick={() => setShowNuevoAcopio(dest.id)}
                            className="text-xs text-blue-600 underline">+ Nuevo</button>
                        </div>
                        <select value={dest.acopio_cliente_id}
                          onChange={e => actualizarDestino(dest.id, 'acopio_cliente_id', e.target.value)}
                          className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400">
                          <option value="">Seleccionar acopio...</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="text-xs font-semibold text-blue-700">Nuevo acopio</div>
                        <input placeholder="Razón social *" value={nuevoAcopioNombre}
                          onChange={e => setNuevoAcopioNombre(e.target.value)}
                          className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm" />
                        <input placeholder="CUIT (opcional)" value={nuevoAcopioCuit}
                          onChange={e => setNuevoAcopioCuit(e.target.value)}
                          className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowNuevoAcopio(null)}
                            className="flex-1 rounded-lg border border-campo-200 px-3 py-1.5 text-xs text-campo-600">Cancelar</button>
                          <button type="button" onClick={() => handleCrearAcopio(dest.id)}
                            disabled={guardandoAcopio || !nuevoAcopioNombre.trim()}
                            className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                            {guardandoAcopio ? 'Guardando...' : 'Crear y seleccionar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button type="button" onClick={agregarDestino}
              className="w-full rounded-lg border border-dashed border-campo-300 py-2 text-xs text-campo-500 hover:bg-campo-100 transition">
              + Agregar otro destino
            </button>
          </div>
        )}

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
