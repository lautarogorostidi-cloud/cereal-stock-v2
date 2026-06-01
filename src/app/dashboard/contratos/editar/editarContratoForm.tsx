'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function EditarContratoForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const numero = searchParams.get('numero')
  const supabase = createClient()

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [puertos, setPuertos] = useState<any[]>([])
  const [acopios, setAcopios] = useState<any[]>([])
  const [monedas, setMonedas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [contratoId, setContratoId] = useState<string | null>(null)

  const [form, setForm] = useState({
    numero: '', nro_operacion_corredor: '',
    fecha_contrato: '', campania_id: '', cultivo_id: '', cliente_id: '',
    cuit_comprador: '', corredor: '', cuit_corredor: '', sucursal: '',
    calidad_producto: '', condicion_entrega: '', pct_condicion: '',
    tipo_precio: 'disponible', precio_unitario: '', moneda_id: '',
    toneladas_pactadas: '', puerto_id: '', acopio_id: '',
    procedencia: '', destino: '',
    fecha_inicio_entrega: '', fecha_fin_entrega: '',
    plazo_fijacion: '', fecha_cobro_corredor: '',
    pago_vendedor_dias: '', documentacion: '', nro_sio_granos: '',
    cupos: '', cupos_asignados: '',
    comision_corredor: '', comision_corredor_monto: '',
    condiciones: '', observaciones: '', estado: 'activo',
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

      if (numero) {
        const { data: contrato } = await supabase
          .from('contratos').select('*').eq('numero', numero).single()
        if (contrato) {
          setContratoId(contrato.id)
          setForm({
            numero: contrato.numero ?? '',
            nro_operacion_corredor: contrato.nro_operacion_corredor ?? '',
            fecha_contrato: contrato.fecha_contrato ?? '',
            campania_id: contrato.campania_id ?? '',
            cultivo_id: contrato.cultivo_id ?? '',
            campania_grano_id: contrato.campania_grano_id ?? '',
            cliente_id: contrato.cliente_id ?? '',
            cuit_comprador: contrato.cuit_comprador ?? '',
            corredor: contrato.corredor_nombre ?? '',
            cuit_corredor: contrato.corredor_cuit ?? '',
            sucursal: contrato.sucursal ?? '',
            calidad_producto: contrato.calidad_producto ?? '',
            condicion_entrega: contrato.condicion_entrega ?? '',
            pct_condicion: contrato.pct_condicion ?? '',
            tipo_precio: contrato.tipo_precio ?? 'disponible',
            precio_unitario: contrato.precio_unitario ?? '',
            moneda_id: contrato.moneda_id ?? '',
            toneladas_pactadas: contrato.toneladas_pactadas ?? '',
            puerto_id: contrato.puerto_id ?? '',
            acopio_id: contrato.acopio_id ?? '',
            procedencia: contrato.procedencia ?? '',
            destino: contrato.destino ?? '',
            fecha_inicio_entrega: contrato.fecha_inicio_entrega ?? '',
            fecha_fin_entrega: contrato.fecha_fin_entrega ?? '',
            plazo_fijacion: contrato.plazo_fijacion ?? '',
            fecha_cobro_corredor: contrato.fecha_cobro_corredor ?? '',
            pago_vendedor_dias: contrato.pago_vendedor_dias ?? '',
            documentacion: contrato.documentacion ?? '',
            nro_sio_granos: contrato.nro_sio_granos ?? '',
            cupos: contrato.cupos ?? '',
            cupos_asignados: contrato.cupos_asignados ?? '',
            comision_corredor: contrato.comision_corredor ?? '',
            comision_corredor_monto: contrato.comision_corredor_monto ?? '',
            condiciones: contrato.condiciones ?? '',
            observaciones: contrato.observaciones ?? '',
            estado: contrato.estado ?? 'activo',
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [numero])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload: any = {
      numero: form.numero,
      fecha_contrato: form.fecha_contrato,
      campania_id: form.campania_id,
      cultivo_id: form.cultivo_id,
      cliente_id: form.cliente_id,
      tipo_precio: form.tipo_precio,
      moneda_id: form.moneda_id,
      toneladas_pactadas: parseFloat(form.toneladas_pactadas),
      estado: form.estado,
      corredor_nombre: form.corredor ? form.corredor : null,
      campania_grano_id: form.campania_grano_id || null,
      corredor_cuit: form.cuit_corredor ? form.cuit_corredor : null,
    }

    if (form.nro_operacion_corredor) payload.nro_operacion_corredor = form.nro_operacion_corredor
    if (form.cuit_comprador) payload.cuit_comprador = form.cuit_comprador
    if (form.sucursal) payload.sucursal = form.sucursal
    if (form.calidad_producto) payload.calidad_producto = form.calidad_producto
    if (form.condicion_entrega) payload.condicion_entrega = form.condicion_entrega
    if (form.pct_condicion) payload.pct_condicion = form.pct_condicion
    if (form.precio_unitario) payload.precio_unitario = parseFloat(form.precio_unitario)
    if (form.puerto_id) payload.puerto_id = form.puerto_id
    if (form.acopio_id) payload.acopio_id = form.acopio_id
    if (form.procedencia) payload.procedencia = form.procedencia
    if (form.destino) payload.destino = form.destino
    if (form.fecha_inicio_entrega) payload.fecha_inicio_entrega = form.fecha_inicio_entrega
    if (form.fecha_fin_entrega) payload.fecha_fin_entrega = form.fecha_fin_entrega
    if (form.plazo_fijacion) payload.plazo_fijacion = form.plazo_fijacion
    if (form.fecha_cobro_corredor) payload.fecha_cobro_corredor = form.fecha_cobro_corredor
    if (form.pago_vendedor_dias) payload.pago_vendedor_dias = form.pago_vendedor_dias
    if (form.documentacion) payload.documentacion = form.documentacion
    if (form.nro_sio_granos) payload.nro_sio_granos = form.nro_sio_granos
    if (form.comision_corredor) payload.comision_corredor = parseFloat(form.comision_corredor)
    if (form.comision_corredor_monto) payload.comision_corredor_monto = parseFloat(form.comision_corredor_monto)
    if (form.condiciones) payload.condiciones = form.condiciones
    if (form.observaciones) payload.observaciones = form.observaciones

    const { error } = await supabase.from('contratos').update(payload).eq('id', contratoId)
    if (error) { setError(error.message); setSaving(false) }
    else { setSuccess(true); setTimeout(() => router.push('/dashboard/contratos'), 1500) }
  }

  const tipoPrecioLabels: Record<string, string> = {
    disponible: 'Disponible', forward: 'Forward',
    mercado_termino: 'Mercado a término', fijado: 'Fijado',
  }

  if (loading) return <div className="flex items-center justify-center h-40 text-campo-400">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Editar Contrato</h1>
          <p className="text-campo-500 text-sm">Contrato {numero}</p>
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Contrato actualizado. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Identificación</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° contrato *</label><input value={form.numero} onChange={e => set('numero', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° operación corredor</label><input value={form.nro_operacion_corredor} onChange={e => set('nro_operacion_corredor', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label><input type="date" value={form.fecha_contrato} onChange={e => set('fecha_contrato', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label>
              <select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field">
                {campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label>
              <select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field">
                {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña del grano</label><select value={form.campania_grano_id} onChange={e => set('campania_grano_id', e.target.value)} className="input-field"><option value="">Misma que el contrato</option>{campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? ' ✓' : ''}</option>)}</select><p className="text-xs text-campo-400 mt-1">Si el grano es de una cosecha anterior</p></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Estado</label>
              <select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-field">
                <option value="borrador">Borrador</option>
                <option value="activo">Activo</option>
                <option value="parcial">Parcial</option>
                <option value="cumplido">Cumplido</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Partes</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Comprador *</label>
              <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} required className="input-field">
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Comprador</label><input value={form.cuit_comprador} onChange={e => set('cuit_comprador', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Corredor</label><input value={form.corredor} onChange={e => set('corredor', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Corredor</label><input value={form.cuit_corredor} onChange={e => set('cuit_corredor', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Sucursal</label><input value={form.sucursal} onChange={e => set('sucursal', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Precio y Comisión</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-2">Tipo de precio</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(tipoPrecioLabels).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => set('tipo_precio', val)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.tipo_precio === val ? 'bg-campo-600 text-white border-campo-600' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Moneda</label>
              <select value={form.moneda_id} onChange={e => set('moneda_id', e.target.value)} className="input-field">
                {monedas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Precio por tonelada</label><input type="number" step="0.01" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas pactadas *</label><input type="number" step="0.001" value={form.toneladas_pactadas} onChange={e => set('toneladas_pactadas', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Calidad</label><input value={form.calidad_producto} onChange={e => set('calidad_producto', e.target.value)} placeholder="Condición Cámara" className="input-field" /></div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Comisión corredor (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={form.comision_corredor} onChange={e => set('comision_corredor', e.target.value)} placeholder="1.50" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Comisión monto fijo</label>
              <input type="number" step="0.01" min="0" value={form.comision_corredor_monto} onChange={e => set('comision_corredor_monto', e.target.value)} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Entrega</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Procedencia</label><input value={form.procedencia} onChange={e => set('procedencia', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Destino</label><input value={form.destino} onChange={e => set('destino', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Puerto</label>
              <select value={form.puerto_id} onChange={e => set('puerto_id', e.target.value)} className="input-field">
                <option value="">Sin puerto</option>
                {puertos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Acopio</label>
              <select value={form.acopio_id} onChange={e => set('acopio_id', e.target.value)} className="input-field">
                <option value="">Sin acopio</option>
                {acopios.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha inicio entrega</label><input type="date" value={form.fecha_inicio_entrega} onChange={e => set('fecha_inicio_entrega', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha fin entrega</label><input type="date" value={form.fecha_fin_entrega} onChange={e => set('fecha_fin_entrega', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary px-8">{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </form>
    </div>
  )
}