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
    nro_operacion_corredor: '',
    fecha_contrato: new Date().toISOString().split('T')[0],
    campania_id: '',
    campania_grano_id: '',
    cultivo_id: '',
    cliente_id: '',
    cuit_comprador: '',
    corredor: '',
    cuit_corredor: '',
    sucursal: '',
    calidad_producto: '',
    condicion_entrega: 'puesto sobre camión',
    pct_condicion: '',
    tipo_precio: 'disponible',
    precio_unitario: '',
    precio_plus: '',
    moneda_id: '',
    toneladas_pactadas: '',
    puerto_id: '',
    acopio_id: '',
    procedencia: 'TRES LOMAS - Buenos Aires',
    destino: '',
    fecha_inicio_entrega: '',
    fecha_fin_entrega: '',
    plazo_fijacion: '',
    fecha_cobro_corredor: '',
    pago_vendedor_dias: '',
    documentacion: '',
    nro_sio_granos: '',
    comision_corredor: '',
    comision_corredor_monto: '',
    cupos: '',
    cupos_asignados: '',
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
      if (c.data?.length) setForm(f => ({ ...f, campania_id: c.data!.find((x:any) => x.activa)?.id ?? c.data![0].id }))
      if (m.data?.length) setForm(f => ({ ...f, moneda_id: m.data!.find((x:any) => x.codigo === 'USD')?.id ?? m.data![0].id }))

      const { data: ultimoContrato } = await supabase
        .from('contratos')
        .select('numero')
        .order('created_at', { ascending: false })
        .limit(10)
      if (ultimoContrato && ultimoContrato.length > 0) {
        const numeros = ultimoContrato
          .map((c: any) => parseInt(c.numero))
          .filter((n: number) => !isNaN(n))
        if (numeros.length > 0) {
          const siguiente = Math.max(...numeros) + 1
          setForm(f => ({ ...f, numero: String(siguiente) }))
        }
      } else {
        setForm(f => ({ ...f, numero: '1' }))
      }
    }
    load()
  }, [])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sin sesión'); setLoading(false); return }

    const extras = []
    if (form.nro_operacion_corredor) extras.push(`N° Op. Corredor: ${form.nro_operacion_corredor}`)
    if (form.cuit_comprador) extras.push(`CUIT Comprador: ${form.cuit_comprador}`)
    if (form.sucursal) extras.push(`Sucursal: ${form.sucursal}`)
    if (form.calidad_producto) extras.push(`Calidad: ${form.calidad_producto}`)
    if (form.condicion_entrega) extras.push(`Condición: ${form.condicion_entrega}${form.pct_condicion ? ` ${form.pct_condicion}%` : ''}`)
    if (form.procedencia) extras.push(`Procedencia: ${form.procedencia}`)
    if (form.destino) extras.push(`Destino: ${form.destino}`)
    if (form.plazo_fijacion) extras.push(`Plazo fijación: ${form.plazo_fijacion}`)
    if (form.fecha_cobro_corredor) extras.push(`Cobro corredor: ${form.fecha_cobro_corredor}`)
    if (form.pago_vendedor_dias) extras.push(`Pago vendedor: ${form.pago_vendedor_dias} día/s`)
    if (form.documentacion) extras.push(`Documentación: ${form.documentacion}`)
    if (form.nro_sio_granos) extras.push(`N° SIO-Granos: ${form.nro_sio_granos}`)
    if (form.cupos) extras.push(`Cupos: ${form.cupos}`)
    if (form.cupos_asignados) extras.push(`Cupos asignados: ${form.cupos_asignados}`)

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
      observaciones: [form.observaciones, ...extras].filter(Boolean).join(' | '),
    }
    if (form.precio_unitario) payload.precio_unitario = parseFloat(form.precio_unitario)
    if (form.precio_plus) payload.precio_plus = parseFloat(form.precio_plus)
    if (form.puerto_id) payload.puerto_id = form.puerto_id
    if (form.acopio_id) payload.acopio_id = form.acopio_id
    if (form.fecha_inicio_entrega) payload.fecha_inicio_entrega = form.fecha_inicio_entrega
    if (form.fecha_fin_entrega) payload.fecha_fin_entrega = form.fecha_fin_entrega
    if (form.campania_grano_id) payload.campania_grano_id = form.campania_grano_id
    if (form.condiciones) payload.condiciones = form.condiciones
    if (form.corredor) payload.corredor_nombre = form.corredor
    if (form.cuit_corredor) payload.corredor_cuit = form.cuit_corredor
    if (form.comision_corredor) payload.comision_corredor = parseFloat(form.comision_corredor)
    if (form.comision_corredor_monto) payload.comision_corredor_monto = parseFloat(form.comision_corredor_monto)

    const { error } = await supabase.from('contratos').insert(payload)
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(() => router.push('/dashboard/contratos'), 1500) }
  }

  const tipoPrecioLabels: Record<string,string> = {
    disponible: 'Disponible', forward: 'Forward',
    mercado_termino: 'Mercado a término', fijado: 'Fijado',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Nuevo Contrato</h1>
          <p className="text-campo-500 text-sm">Registrá un contrato de venta de cereal</p>
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Contrato registrado. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Identificación */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Identificación</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° contrato propio *</label><input value={form.numero} onChange={e => set('numero', e.target.value)} required placeholder="CTR-001" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° operación corredor</label><input value={form.nro_operacion_corredor} onChange={e => set('nro_operacion_corredor', e.target.value)} placeholder="903290" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha *</label><input type="date" value={form.fecha_contrato} onChange={e => set('fecha_contrato', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label><select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label><select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña del grano</label><select value={form.campania_grano_id} onChange={e => set('campania_grano_id', e.target.value)} className="input-field"><option value="">Misma que el contrato</option>{campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.activa ? ' ✓' : ''}</option>)}</select><p className="text-xs text-campo-400 mt-1">Si el grano es de una cosecha anterior</p></div>
          </div>
        </div>

        {/* Partes */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Partes intervinientes</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Comprador *</label><select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} required className="input-field"><option value="">Seleccioná comprador</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Comprador</label><input value={form.cuit_comprador} onChange={e => set('cuit_comprador', e.target.value)} placeholder="30-71715781-4" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Corredor</label><input value={form.corredor} onChange={e => set('corredor', e.target.value)} placeholder="DUKAREVICH SA" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Corredor</label><input value={form.cuit_corredor} onChange={e => set('cuit_corredor', e.target.value)} placeholder="30-51753557-1" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Sucursal</label><input value={form.sucursal} onChange={e => set('sucursal', e.target.value)} placeholder="CENTRAL" className="input-field" /></div>
          </div>
        </div>

        {/* Producto y Precio */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Producto y Precio</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Calidad del producto</label><input value={form.calidad_producto} onChange={e => set('calidad_producto', e.target.value)} placeholder="Condición Cámara" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Condición de entrega</label><input value={form.condicion_entrega} onChange={e => set('condicion_entrega', e.target.value)} placeholder="puesto sobre camión" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">% condición</label><input value={form.pct_condicion} onChange={e => set('pct_condicion', e.target.value)} placeholder="95" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas *</label><input type="number" step="0.001" value={form.toneladas_pactadas} onChange={e => set('toneladas_pactadas', e.target.value)} required placeholder="100.000" className="input-field" /></div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-campo-700 mb-2">Tipo de precio</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(tipoPrecioLabels).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => set('tipo_precio', val)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.tipo_precio===val?'bg-campo-600 text-white border-campo-600':'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Moneda</label><select value={form.moneda_id} onChange={e => set('moneda_id', e.target.value)} className="input-field">{monedas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
            <div>
              <label className="block text-sm font-medium text-campo-700 mb-1">Precio por tonelada</label>
              <div className="flex gap-2 items-center">
                <input type="number" step="0.01" value={form.precio_unitario} onChange={e => set('precio_unitario', e.target.value)} placeholder="400" className="input-field" />
                <span className="text-campo-500 font-bold text-lg">+</span>
                <input type="number" step="0.01" value={form.precio_plus} onChange={e => set('precio_plus', e.target.value)} placeholder="30" className="input-field w-28" />
                <span className="text-campo-400 text-sm whitespace-nowrap">plus</span>
              </div>
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Entrega</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Procedencia</label><input value={form.procedencia} onChange={e => set('procedencia', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Destino</label><input value={form.destino} onChange={e => set('destino', e.target.value)} placeholder="BAHIA BLANCA - Buenos Aires" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Puerto</label><select value={form.puerto_id} onChange={e => set('puerto_id', e.target.value)} className="input-field"><option value="">Sin puerto</option>{puertos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Acopio</label><select value={form.acopio_id} onChange={e => set('acopio_id', e.target.value)} className="input-field"><option value="">Sin acopio</option>{acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha inicio entrega</label><input type="date" value={form.fecha_inicio_entrega} onChange={e => set('fecha_inicio_entrega', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha fin entrega</label><input type="date" value={form.fecha_fin_entrega} onChange={e => set('fecha_fin_entrega', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        {/* Condiciones comerciales */}
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Condiciones comerciales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Plazo de fijación</label><input value={form.plazo_fijacion} onChange={e => set('plazo_fijacion', e.target.value)} placeholder="30/06/2026" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha cobro corredor</label><input type="date" value={form.fecha_cobro_corredor} onChange={e => set('fecha_cobro_corredor', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Pago al vendedor (días)</label><input value={form.pago_vendedor_dias} onChange={e => set('pago_vendedor_dias', e.target.value)} placeholder="1 día más" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Documentación requerida</label><input value={form.documentacion} onChange={e => set('documentacion', e.target.value)} placeholder="Certificado de Depósito" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° SIO-GRANOS</label><input value={form.nro_sio_granos} onChange={e => set('nro_sio_granos', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cupos</label><input value={form.cupos} onChange={e => set('cupos', e.target.value)} className="input-field" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Cupos asignados</label><input value={form.cupos_asignados} onChange={e => set('cupos_asignados', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Comisión corredor (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={form.comision_corredor} onChange={e => set('comision_corredor', e.target.value)} placeholder="1.50" className="input-field" />
              <p className="text-xs text-campo-400 mt-1">Ej: 1.5 para 1.5%</p>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Comisión monto fijo</label>
              <input type="number" step="0.01" min="0" value={form.comision_corredor_monto} onChange={e => set('comision_corredor_monto', e.target.value)} placeholder="0.00" className="input-field" />
              <p className="text-xs text-campo-400 mt-1">Si es monto fijo en vez de %</p>
            </div>
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} placeholder="por el tipo de cambio de hoy [Nro SIO-GRANOS:]" className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary px-8">{loading ? 'Guardando...' : 'Guardar contrato'}</button>
        </div>
      </form>
    </div>
  )
}
