'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  function handleModo(m: 'entrada' | 'salida') {
    setModo(m)
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
      toneladas: parseFloat(form.toneladas),
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

    const { error } = await supabase.from('movimientos_cereal').insert(payload)
    if (error) { setError(error.message); setLoading(false) }
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
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas *</label><input type="number" step="0.001" min="0" value={form.toneladas} onChange={e => set('toneladas', e.target.value)} required placeholder="0.000" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Humedad (%)</label><input type="number" step="0.01" value={form.humedad} onChange={e => set('humedad', e.target.value)} placeholder="13.5" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Proteína (%)</label><input type="number" step="0.01" value={form.proteina} onChange={e => set('proteina', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Hectolítrico</label><input type="number" step="0.01" value={form.peso_hectolitrico} onChange={e => set('peso_hectolitrico', e.target.value)} className="input-field" /></div>
          </div>
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
