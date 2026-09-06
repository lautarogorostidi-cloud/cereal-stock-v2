'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cargarSilosDisponibles, crearMovimientosConOrigen, etiquetaSilo, origenesValidos, totalOrigenes, type OrigenSeleccionado, type SiloDisponible } from '@/lib/stockOrigenes'

const ENTRADAS = [
  { value: 'cosecha', label: '🌾 Cosecha' },
  { value: 'compra', label: '🛒 Compra' },
  { value: 'recepcion_cliente', label: '📦 Recepción de cliente' },
  { value: 'otro_ingreso', label: '➕ Otro ingreso' },
]

const SALIDAS = [
  { value: 'entrega', label: '🚛 Entrega' },
  { value: 'consumo_hacienda', label: '🐄 Consumo hacienda' },
  { value: 'merma', label: '📉 Merma / Desperdicio' },
  { value: 'otro_egreso', label: '➖ Otro egreso' },
]

export default function NuevoMovimientoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [monedas, setMonedas] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [modo, setModo] = useState<'entrada' | 'salida'>('entrada')
  const [silosCampo, setSilosCampo] = useState<SiloDisponible[]>([])
  const [acopiosCosecha, setAcopiosCosecha] = useState<SiloDisponible[]>([])
  const [origenSilos, setOrigenSilos] = useState<OrigenSeleccionado[]>([])

  const [form, setForm] = useState({
    tipo: 'cosecha',
    descripcion_movimiento: '',
    fecha: new Date().toISOString().split('T')[0],
    campania_id: '',
    cultivo_id: '',
    lote_id: '',
    toneladas: '',
    humedad: '',
    proteina: '',
    peso_hectolitrico: '',
    cliente_id: '',
    contrato_id: '',
    precio_unitario: '',
    moneda_id: '',
    flete: '',
    secado: '',
    otros_gastos: '',
    observaciones: '',
  })

  useEffect(() => {
    async function load() {
      const [c, cu, l, cl, m, co] = await Promise.all([
        supabase.from('campanias').select('*').order('nombre', { ascending: false }),
        supabase.from('cultivos').select('*').eq('activo', true).order('nombre'),
        supabase.from('lotes').select('*').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('*').eq('activo', true).order('razon_social'),
        supabase.from('monedas').select('*'),
        supabase.from('contratos').select('*, cultivos(nombre), clientes(razon_social)').in('estado', ['activo', 'parcial']).order('created_at', { ascending: false }),
      ])
      setCampanias(c.data ?? [])
      setCultivos(cu.data ?? [])
      setLotes(l.data ?? [])
      setClientes(cl.data ?? [])
      setMonedas(m.data ?? [])
      setContratos(co.data ?? [])
      if (c.data?.length) setForm(f => ({ ...f, campania_id: c.data!.find((x: any) => x.activa)?.id ?? c.data![0].id }))
      if (m.data?.length) setForm(f => ({ ...f, moneda_id: m.data!.find((x: any) => x.codigo === 'ARS')?.id ?? m.data![0].id }))
    }
    load()
  }, [])

  // Cargar silos/acopios con stock disponible cuando cambia campaña, cultivo o modo
  useEffect(() => {
    if (modo !== 'salida' || !form.campania_id || !form.cultivo_id) { setSilosCampo([]); setAcopiosCosecha([]); return }
    const campaniaNombre = campanias.find((c:any) => c.id === form.campania_id)?.nombre ?? ''
    if (!campaniaNombre) return
    const cargarSilos = async () => {
      const data = await cargarSilosDisponibles(supabase, campaniaNombre, form.cultivo_id)
      setSilosCampo(data.filter(s => s.ubicacion === 'campo'))
      setAcopiosCosecha(data.filter(s => s.ubicacion === 'acopio'))
    }
    cargarSilos()
  }, [modo, form.campania_id, form.cultivo_id, campanias, cultivos])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  function handleModo(m: 'entrada' | 'salida') {
    setModo(m)
    setOrigenSilos([])
    setForm(f => ({ ...f, tipo: m === 'entrada' ? 'cosecha' : 'entrega' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sin sesión'); setLoading(false); return }

    const payload: any = {
      tipo: form.tipo,
      fecha: form.fecha,
      campania_id: form.campania_id,
      cultivo_id: form.cultivo_id,
      usuario_id: session.user.id,
    }
    if (form.descripcion_movimiento) payload.descripcion_movimiento = form.descripcion_movimiento
    if (form.lote_id) payload.lote_id = form.lote_id
    if (form.humedad) payload.humedad = parseFloat(form.humedad)
    if (form.proteina) payload.proteina = parseFloat(form.proteina)
    if (form.peso_hectolitrico) payload.peso_hectolitrico = parseFloat(form.peso_hectolitrico)
    if (form.cliente_id) payload.cliente_id = form.cliente_id
    if (form.contrato_id) payload.contrato_id = form.contrato_id
    if (form.precio_unitario) payload.precio_unitario = parseFloat(form.precio_unitario)
    if (form.moneda_id) payload.moneda_id = form.moneda_id
    if (form.flete) payload.flete = parseFloat(form.flete)
    if (form.secado) payload.secado = parseFloat(form.secado)
    if (form.otros_gastos) payload.otros_gastos = parseFloat(form.otros_gastos)
    if (form.observaciones) payload.observaciones = form.observaciones

    const toneladasTotales = parseFloat(form.toneladas)
    // En salidas con origen indicado, se crea un movimiento por cada silo/acopio
    // (vinculado en movimiento_cereal_origenes) para descontar el stock puntual.
    // flete/secado/otros_gastos son montos totales de la operación: si se reparte
    // entre varios orígenes, cada movimiento se queda con su parte proporcional
    // (precio_unitario no se prorratea porque es una tarifa por tonelada).
    const origenesASalida = modo === 'salida' ? origenSilos : []
    const { error } = await crearMovimientosConOrigen(supabase, origenesASalida, payload, toneladasTotales, ['flete', 'secado', 'otros_gastos'])
    if (error) { setError(error); setLoading(false) }
    else { setSuccess(true); setTimeout(() => router.push('/dashboard/ventas'), 1500) }
  }

  const tiposActuales = modo === 'entrada' ? ENTRADAS : SALIDAS
  const mostrarPrecio = ['cosecha', 'compra', 'entrega', 'recepcion_cliente'].includes(form.tipo)
  const mostrarContrato = form.tipo === 'entrega'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Nuevo Movimiento</h1>
          <p className="text-campo-500 text-sm">Registrá entradas o salidas de cereal</p>
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Movimiento registrado. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Tipo de movimiento</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button type="button" onClick={() => handleModo('entrada')}
              className={`py-3 rounded-xl font-semibold text-sm transition-colors border-2 ${modo === 'entrada' ? 'bg-campo-600 text-white border-campo-600' : 'bg-white text-campo-600 border-campo-200 hover:bg-campo-50'}`}>
              ➕ Entrada de cereal
            </button>
            <button type="button" onClick={() => handleModo('salida')}
              className={`py-3 rounded-xl font-semibold text-sm transition-colors border-2 ${modo === 'salida' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-500 border-red-200 hover:bg-red-50'}`}>
              ➖ Salida de cereal
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {tiposActuales.map(t => (
              <button key={t.value} type="button" onClick={() => set('tipo', t.value)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors text-left ${form.tipo === t.value ? 'bg-campo-600 text-white border-campo-600' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {(form.tipo === 'otro_ingreso' || form.tipo === 'otro_egreso') && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-campo-700 mb-1">Descripción *</label>
              <input value={form.descripcion_movimiento} onChange={e => set('descripcion_movimiento', e.target.value)}
                required placeholder="Ej: Devolución por calidad, préstamo a vecino, etc."
                className="input-field" />
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Datos del movimiento</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
              <select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field">
                <option value="">Seleccioná</option>
                {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? ' ✓' : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label>
              <select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field">
                <option value="">Seleccioná</option>
                {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Lote / Campo</label>
              <select value={form.lote_id} onChange={e => set('lote_id', e.target.value)} className="input-field">
                <option value="">Sin lote</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.establecimiento}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas *</label><input type="number" step="0.001" min="0" value={form.toneladas} onChange={e => set('toneladas', e.target.value)} required placeholder="0.000" className="input-field" />
              {origenesValidos(origenSilos).length > 0 && <p className="text-xs text-campo-400 mt-1">Se usa la suma de los orígenes de abajo ({totalOrigenes(origenSilos).toLocaleString('es-AR', {maximumFractionDigits:3})} tn) en vez de este valor.</p>}
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Humedad (%)</label><input type="number" step="0.01" value={form.humedad} onChange={e => set('humedad', e.target.value)} placeholder="13.5" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Proteína (%)</label><input type="number" step="0.01" value={form.proteina} onChange={e => set('proteina', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Hectolítrico</label><input type="number" step="0.01" value={form.peso_hectolitrico} onChange={e => set('peso_hectolitrico', e.target.value)} className="input-field" /></div>
          </div>

          {/* Origen del cereal — solo en salidas, cuando hay silos/acopios cargados para este cultivo/campaña */}
          {modo === 'salida' && (silosCampo.length > 0 || acopiosCosecha.length > 0) && (
            <div className="mt-4 rounded-lg border border-campo-200 bg-campo-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-campo-700">Origen del cereal</label>
                <button type="button"
                  onClick={() => setOrigenSilos(prev => [...prev, {id: Date.now().toString(), destino_id: '', ubicacion: 'campo', etiqueta: '', acopio_cliente_id: null, disponible: 0, toneladas: ''}])}
                  className="text-xs text-campo-500 underline hover:text-campo-700">+ Agregar silo</button>
              </div>
              {origenSilos.length === 0 && (
                <p className="text-xs text-campo-400 italic">Sin origen seleccionado — hacé clic en + Agregar silo</p>
              )}
              <div className="space-y-2">
                {origenSilos.map((orig, idx) => {
                  const excede = Number(orig.toneladas) > 0 && Number(orig.toneladas) > orig.disponible
                  return (
                  <div key={orig.id}>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-campo-500 mb-1 block">Silo / Acopio</label>
                        <select value={orig.destino_id}
                          onChange={e => {
                            const destinoId = e.target.value
                            const s = [...silosCampo, ...acopiosCosecha].find(x => x.destino_id === destinoId)
                            setOrigenSilos(prev => prev.map((o,i) => i===idx ? {
                              ...o,
                              destino_id: destinoId,
                              ubicacion: s?.ubicacion ?? 'campo',
                              etiqueta: s ? etiquetaSilo(s) : '',
                              acopio_cliente_id: s?.acopio_cliente_id ?? null,
                              disponible: s?.stock_actual ?? 0,
                            } : o))
                          }}
                          className="input-field">
                          <option value="">Seleccionar origen...</option>
                          {silosCampo.length > 0 && <optgroup label="🌾 Silos de campo">
                            {silosCampo.map(s => (
                              <option key={s.destino_id} value={s.destino_id}>
                                {etiquetaSilo(s)} — disponible {Number(s.stock_actual).toLocaleString('es-AR', {maximumFractionDigits:3})} tn
                              </option>
                            ))}
                          </optgroup>}
                          {acopiosCosecha.length > 0 && <optgroup label="🏭 Acopios">
                            {acopiosCosecha.map(s => (
                              <option key={s.destino_id} value={s.destino_id}>
                                {etiquetaSilo(s)} — disponible {Number(s.stock_actual).toLocaleString('es-AR', {maximumFractionDigits:3})} tn
                              </option>
                            ))}
                          </optgroup>}
                        </select>
                      </div>
                      <div className="w-36">
                        <label className="text-xs text-campo-500 mb-1 block">Toneladas</label>
                        <input type="number" min={0} step="0.001"
                          value={orig.toneladas}
                          onChange={e => setOrigenSilos(prev => prev.map((o,i) => i===idx ? {...o, toneladas: e.target.value} : o))}
                          placeholder="0.000"
                          className={`input-field ${excede ? 'border-amber-400' : ''}`} />
                      </div>
                      <button type="button"
                        onClick={() => setOrigenSilos(prev => prev.filter((_,i) => i!==idx))}
                        className="text-red-400 hover:text-red-600 text-lg leading-none mb-1">×</button>
                    </div>
                    {excede && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Supera el disponible ({orig.disponible.toLocaleString('es-AR', {maximumFractionDigits:3})} tn) — se guarda igual, revisá el stock del silo.</p>
                    )}
                  </div>
                )})}
                {totalOrigenes(origenSilos) > 0 && (
                  <div className="text-xs text-campo-500 text-right font-medium">
                    Total: {totalOrigenes(origenSilos).toLocaleString('es-AR', {maximumFractionDigits:3})} tn
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Contraparte</h2>
          <div className="grid grid-cols-1 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cliente</label>
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="input-field">
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            {mostrarContrato && (
              <div><label className="block text-sm font-medium text-campo-700 mb-1">Contrato vinculado</label>
                <select value={form.contrato_id} onChange={e => set('contrato_id', e.target.value)} className="input-field">
                  <option value="">Sin contrato</option>
                  {contratos.map(c => <option key={c.id} value={c.id}>{c.numero} — {(c.cultivos as any)?.nombre} — {(c.clientes as any)?.razon_social}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {mostrarPrecio && (
          <div className="card">
            <h2 className="font-semibold text-campo-800 mb-4">Precio y gastos <span className="text-campo-400 font-normal text-sm">(opcional)</span></h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-campo-700 mb-1">Moneda</label>
                <select value={form.moneda_id} onChange={e => set('moneda_id', e.target.value)} className="input-field">
                  {monedas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div><label className="block text-sm font-medium text-campo-700 mb-1">Precio por tonelada</label><input type="number" step="0.01" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-campo-700 mb-1">Flete</label><input type="number" step="0.01" value={form.flete} onChange={e => set('flete', e.target.value)} className="input-field" /></div>
              <div><label className="block text-sm font-medium text-campo-700 mb-1">Secado</label><input type="number" step="0.01" value={form.secado} onChange={e => set('secado', e.target.value)} className="input-field" /></div>
              <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Otros gastos</label><input type="number" step="0.01" value={form.otros_gastos} onChange={e => set('otros_gastos', e.target.value)} className="input-field" /></div>
            </div>
          </div>
        )}

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading}
            className={`px-8 py-2 rounded-lg font-medium text-sm text-white transition-colors ${modo === 'entrada' ? 'bg-campo-600 hover:bg-campo-700' : 'bg-red-500 hover:bg-red-600'}`}>
            {loading ? 'Guardando...' : `Guardar ${modo === 'entrada' ? 'entrada' : 'salida'}`}
          </button>
        </div>
      </form>
    </div>
  )
}
