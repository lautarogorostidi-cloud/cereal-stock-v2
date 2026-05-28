'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NuevoMovimientoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [acopios, setAcopios] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [monedas, setMonedas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    tipo: 'cosecha',
    fecha: new Date().toISOString().split('T')[0],
    campania_id: '',
    cultivo_id: '',
    lote_id: '',
    toneladas: '',
    humedad: '',
    proteina: '',
    peso_hectolitrico: '',
    cliente_id: '',
    acopio_origen_id: '',
    acopio_destino_id: '',
    precio_unitario: '',
    moneda_id: '',
    flete: '',
    secado: '',
    otros_gastos: '',
    observaciones: '',
  })

  useEffect(() => {
    async function load() {
      const [c, cu, l, a, cl, m] = await Promise.all([
        supabase.from('campanias').select('*').order('nombre', { ascending: false }),
        supabase.from('cultivos').select('*').eq('activo', true).order('nombre'),
        supabase.from('lotes').select('*').eq('activo', true).order('nombre'),
        supabase.from('acopios').select('*').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('*').eq('activo', true).order('razon_social'),
        supabase.from('monedas').select('*'),
      ])
      setCampanias(c.data ?? [])
      setCultivos(cu.data ?? [])
      setLotes(l.data ?? [])
      setAcopios(a.data ?? [])
      setClientes(cl.data ?? [])
      setMonedas(m.data ?? [])

      // Preseleccionar campaña activa y moneda ARS
      if (c.data?.length) setForm(f => ({ ...f, campania_id: c.data!.find(x => x.activa)?.id ?? c.data![0].id }))
      if (m.data?.length) setForm(f => ({ ...f, moneda_id: m.data!.find(x => x.codigo === 'ARS')?.id ?? m.data![0].id }))
    }
    load()
  }, [])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
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

    if (form.lote_id) payload.lote_id = form.lote_id
    if (form.humedad) payload.humedad = parseFloat(form.humedad)
    if (form.proteina) payload.proteina = parseFloat(form.proteina)
    if (form.peso_hectolitrico) payload.peso_hectolitrico = parseFloat(form.peso_hectolitrico)
    if (form.cliente_id) payload.cliente_id = form.cliente_id
    if (form.acopio_origen_id) payload.acopio_origen_id = form.acopio_origen_id
    if (form.acopio_destino_id) payload.acopio_destino_id = form.acopio_destino_id
    if (form.precio_unitario) payload.precio_unitario = parseFloat(form.precio_unitario)
    if (form.moneda_id) payload.moneda_id = form.moneda_id
    if (form.flete) payload.flete = parseFloat(form.flete)
    if (form.secado) payload.secado = parseFloat(form.secado)
    if (form.otros_gastos) payload.otros_gastos = parseFloat(form.otros_gastos)
    if (form.observaciones) payload.observaciones = form.observaciones

    const { error } = await supabase.from('movimientos_cereal').insert(payload)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/ventas'), 1500)
    }
  }

  const tipoLabels: Record<string, string> = {
    cosecha: '🌾 Cosecha',
    venta: '💰 Venta',
    entrega: '🚛 Entrega',
    transferencia: '🔄 Transferencia',
    ajuste: '⚙️ Ajuste',
    devolucion: '↩️ Devolución',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Nuevo Movimiento</h1>
          <p className="text-campo-500 text-sm">Registrá cosecha, venta, entrega o transferencia</p>
        </div>
      </div>

      {success && (
        <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">
          ✅ Movimiento registrado correctamente. Redirigiendo...
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de movimiento */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Tipo de movimiento</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(tipoLabels).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => set('tipo', val)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  form.tipo === val
                    ? 'bg-campo-600 text-white border-campo-600'
                    : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Datos básicos */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Datos básicos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
              <select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field">
                <option value="">Seleccioná campaña</option>
                {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? ' ✓' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label>
              <select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field">
                <option value="">Seleccioná cultivo</option>
                {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Lote / Campo</label>
              <select value={form.lote_id} onChange={e => set('lote_id', e.target.value)} className="input-field">
                <option value="">Sin lote</option>
                {lotes.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.establecimiento}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Toneladas *</label>
              <input type="number" step="0.001" min="0" value={form.toneladas} onChange={e => set('toneladas', e.target.value)} required placeholder="0.000" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Humedad (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={form.humedad} onChange={e => set('humedad', e.target.value)} placeholder="13.5" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Proteína (%)</label>
              <input type="number" step="0.01" value={form.proteina} onChange={e => set('proteina', e.target.value)} placeholder="38.0" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Peso Hectolítrico</label>
              <input type="number" step="0.01" value={form.peso_hectolitrico} onChange={e => set('peso_hectolitrico', e.target.value)} placeholder="78.0" className="input-field" />
            </div>
          </div>
        </div>

        {/* Origen / Destino */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Origen y destino</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Acopio origen</label>
              <select value={form.acopio_origen_id} onChange={e => set('acopio_origen_id', e.target.value)} className="input-field">
                <option value="">Sin acopio origen</option>
                {acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Acopio destino</label>
              <select value={form.acopio_destino_id} onChange={e => set('acopio_destino_id', e.target.value)} className="input-field">
                <option value="">Sin acopio destino</option>
                {acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-1">Cliente / Comprador</label>
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} className="input-field">
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Precio y gastos */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Precio y gastos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Moneda</label>
              <select value={form.moneda_id} onChange={e => set('moneda_id', e.target.value)} className="input-field">
                {monedas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Precio unitario (por tn)</label>
              <input type="number" step="0.01" min="0" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} placeholder="350000" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Flete (por tn)</label>
              <input type="number" step="0.01" min="0" value={form.flete} onChange={e => set('flete', e.target.value)} placeholder="0" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Secado (por tn)</label>
              <input type="number" step="0.01" min="0" value={form.secado} onChange={e => set('secado', e.target.value)} placeholder="0" className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-1">Otros gastos (por tn)</label>
              <input type="number" step="0.01" min="0" value={form.otros_gastos} onChange={e => set('otros_gastos', e.target.value)} placeholder="0" className="input-field" />
            </div>
          </div>
        </div>

        {/* Observaciones */}
        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} placeholder="Notas adicionales..." className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary px-8">
            {loading ? 'Guardando...' : 'Guardar movimiento'}
          </button>
        </div>
      </form>
    </div>
  )
}
