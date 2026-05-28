'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NuevoContratoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [puertos, setPuertos] = useState<any[]>([])
  const [acopios, setAcopios] = useState<any[]>([])
  const [monedas, setMonedas] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    numero: '',
    fecha_contrato: new Date().toISOString().split('T')[0],
    campania_id: '',
    cultivo_id: '',
    cliente_id: '',
    tipo_precio: 'disponible',
    precio_unitario: '',
    moneda_id: '',
    toneladas_pactadas: '',
    puerto_id: '',
    acopio_id: '',
    fecha_inicio_entrega: '',
    fecha_fin_entrega: '',
    condiciones: '',
    observaciones: '',
  })

  useEffect(() => {
    async function load() {
      const [c, cu, cl, p, a, m] = await Promise.all([
        supabase.from('campanias').select('*').order('nombre', { ascending: false }),
        supabase.from('cultivos').select('*').eq('activo', true).order('nombre'),
        supabase.from('clientes').select('*').eq('activo', true).order('razon_social'),
        supabase.from('puertos').select('*').eq('activo', true).order('nombre'),
        supabase.from('acopios').select('*').eq('activo', true).order('nombre'),
        supabase.from('monedas').select('*'),
      ])
      setCampanias(c.data ?? [])
      setCultivos(cu.data ?? [])
      setClientes(cl.data ?? [])
      setPuertos(p.data ?? [])
      setAcopios(a.data ?? [])
      setMonedas(m.data ?? [])

      if (c.data?.length) setForm(f => ({ ...f, campania_id: c.data!.find(x => x.activa)?.id ?? c.data![0].id }))
      if (m.data?.length) setForm(f => ({ ...f, moneda_id: m.data!.find(x => x.codigo === 'USD')?.id ?? m.data![0].id }))
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
      numero: form.numero,
      fecha_contrato: form.fecha_contrato,
      campania_id: form.campania_id,
      cultivo_id: form.cultivo_id,
      cliente_id: form.cliente_id,
      tipo_precio: form.tipo_precio,
      moneda_id: form.moneda_id,
      toneladas_pactadas: parseFloat(form.toneladas_pactadas),
      estado: 'activo',
      usuario_id: session.user.id,
    }

    if (form.precio_unitario) payload.precio_unitario = parseFloat(form.precio_unitario)
    if (form.puerto_id) payload.puerto_id = form.puerto_id
    if (form.acopio_id) payload.acopio_id = form.acopio_id
    if (form.fecha_inicio_entrega) payload.fecha_inicio_entrega = form.fecha_inicio_entrega
    if (form.fecha_fin_entrega) payload.fecha_fin_entrega = form.fecha_fin_entrega
    if (form.condiciones) payload.condiciones = form.condiciones
    if (form.observaciones) payload.observaciones = form.observaciones

    const { error } = await supabase.from('contratos').insert(payload)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard/contratos'), 1500)
    }
  }

  const tipoPrecioLabels: Record<string, string> = {
    disponible: 'Disponible',
    forward: 'Forward',
    mercado_termino: 'Mercado a término',
    fijado: 'Precio fijado',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Nuevo Contrato</h1>
          <p className="text-campo-500 text-sm">Registrá un contrato de venta</p>
        </div>
      </div>

      {success && (
        <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">
          ✅ Contrato registrado correctamente. Redirigiendo...
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificación */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Identificación</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Número de contrato *</label>
              <input type="text" value={form.numero} onChange={e => set('numero', e.target.value)} required placeholder="CTR-001" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha_contrato} onChange={e => set('fecha_contrato', e.target.value)} required className="input-field" />
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-1">Cliente / Comprador *</label>
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} required className="input-field">
                <option value="">Seleccioná cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Precio */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Precio</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-2">Tipo de precio</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(tipoPrecioLabels).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => set('tipo_precio', val)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.tipo_precio === val ? 'bg-campo-600 text-white border-campo-600' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Moneda</label>
              <select value={form.moneda_id} onChange={e => set('moneda_id', e.target.value)} className="input-field">
                {monedas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Precio por tonelada</label>
              <input type="number" step="0.01" min="0" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} placeholder="280" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Toneladas pactadas *</label>
              <input type="number" step="0.001" min="0" value={form.toneladas_pactadas} onChange={e => set('toneladas_pactadas', e.target.value)} required placeholder="500.000" className="input-field" />
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Entrega</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Puerto destino</label>
              <select value={form.puerto_id} onChange={e => set('puerto_id', e.target.value)} className="input-field">
                <option value="">Sin puerto</option>
                {puertos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Acopio</label>
              <select value={form.acopio_id} onChange={e => set('acopio_id', e.target.value)} className="input-field">
                <option value="">Sin acopio</option>
                {acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Fecha inicio entrega</label>
              <input type="date" value={form.fecha_inicio_entrega} onChange={e => set('fecha_inicio_entrega', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Fecha fin entrega</label>
              <input type="date" value={form.fecha_fin_entrega} onChange={e => set('fecha_fin_entrega', e.target.value)} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-1">Condiciones</label>
              <input type="text" value={form.condiciones} onChange={e => set('condiciones', e.target.value)} placeholder="FAS Rosario, etc." className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} placeholder="Notas adicionales..." className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary px-8">
            {loading ? 'Guardando...' : 'Guardar contrato'}
          </button>
        </div>
      </form>
    </div>
  )
}
