'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function EditarCartaPorteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const numeroCpe = searchParams.get('numero_cpe')
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [acopios, setAcopios] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cartaId, setCartaId] = useState<string | null>(null)

  const [form, setForm] = useState({
    numero_cpe: '', ctg: '',
    fecha_emision: '',
    fecha_vencimiento: '',
    campania_id: '', cultivo_id: '', contrato_id: '',
    cuit_titular: '30717870944',
    razon_social_titular: 'BARATZA S.R.L.',
    cuit_rte_productor: '',
    cuit_mercado_termino: '',
    cuit_flete_pagador: '30717870944',
    remitente_comercial_productor: '',
    remitente_comercial: '', cuit_remitente: '',
    remitente_venta_secundaria: '', cuit_rte_secundaria: '',
    remitente_venta_secundaria2: '', cuit_rte_secundaria2: '',
    mercado_termino: '',
    corredor_venta_primaria: '', cuit_corredor_primaria: '',
    corredor_venta_secundaria: '', cuit_corredor_secundaria: '',
    destinatario: '', cuit_destinatario: '',
    destino: '', cuit_destino: '',
    empresa_transportista: '', cuit_transportista: '',
    representante_entregador: '', cuit_rep_entregador: '',
    representante_recibidor: '', cuit_rep_recibidor: '',
    intermediario_flete: '', cuit_intermediario: '',
    chofer_nombre: '', chofer_cuil: '',
    flete_pagador: 'BARATZA SRL',
    lote_id: '',
    peso_bruto_kg: '', peso_tara_kg: '',
    toneladas_origen: '',
    declaracion_calidad: 'conforme',
    humedad_origen: '', proteina: '', gluten: '',
    peso_hectolitrico: '', zaranda: '',
    procedencia_localidad: 'TRES LOMAS',
    procedencia_provincia: 'BUENOS AIRES',
    renspa: '', latitud: '', longitud: '', descripcion_campo: '',
    origen_acopio_id: '', destino_acopio_id: '',
    destino_localidad: '', destino_provincia: '',
    nro_planta: '', destino_direccion: '',
    patente_camion: '', patente_acoplado: '',
    fecha_partida: '', hora_partida: '', km_recorrer: '', tarifa_flete: '',
    fecha_arribo: '', fecha_descarga: '', nro_turno: '',
    peso_bruto_destino: '', peso_tara_destino: '',
    humedad_destino: '', observaciones: '',
    bonificacion_calidad: '',
    estado: 'emitida',
  })

  useEffect(() => {
    async function load() {
      const [c, cu, l, a, co] = await Promise.all([
        supabase.from('campanias').select('*').order('nombre', { ascending: false }),
        supabase.from('cultivos').select('*').eq('activo', true).order('nombre'),
        supabase.from('lotes').select('*').eq('activo', true).order('nombre'),
        supabase.from('acopios').select('*').eq('activo', true).order('nombre'),
        supabase.from('contratos').select('*, cultivos(nombre), clientes(razon_social)').order('created_at', { ascending: false }).limit(50),
      ])
      setCampanias(c.data ?? [])
      setCultivos(cu.data ?? [])
      setLotes(l.data ?? [])
      setAcopios(a.data ?? [])
      setContratos(co.data ?? [])

      if (numeroCpe) {
        const { data: carta } = await supabase
          .from('cartas_porte')
          .select('*')
          .eq('numero_cpe', numeroCpe)
          .single()

        if (carta) {
          setCartaId(carta.id)
          const obs = carta.observaciones ?? ''
          setForm({
            numero_cpe: carta.numero_cpe ?? '',
            ctg: carta.ctg ?? '',
            fecha_emision: carta.fecha_emision ?? '',
            fecha_vencimiento: obs.match(/Venc: ([^\|]+)/)?.[1]?.trim() ?? '',
            campania_id: carta.campania_id ?? '',
            cultivo_id: carta.cultivo_id ?? '',
            contrato_id: carta.contrato_id ?? '',
            cuit_titular: obs.match(/CUIT Titular: ([^\|]+)/)?.[1]?.trim() ?? '30717870944',
            razon_social_titular: 'BARATZA S.R.L.',
            cuit_rte_productor: '',
            cuit_mercado_termino: '',
            cuit_flete_pagador: '30717870944',
            remitente_comercial_productor: '',
            remitente_comercial: obs.match(/Remitente: ([^(]+)/)?.[1]?.trim() ?? '',
            cuit_remitente: obs.match(/Remitente: [^(]+\(([^)]+)\)/)?.[1]?.trim() ?? '',
            remitente_venta_secundaria: '', cuit_rte_secundaria: '',
            remitente_venta_secundaria2: '', cuit_rte_secundaria2: '',
            mercado_termino: '',
            corredor_venta_primaria: '', cuit_corredor_primaria: '',
            corredor_venta_secundaria: '', cuit_corredor_secundaria: '',
            destinatario: obs.match(/Destinatario: ([^(]+)/)?.[1]?.trim() ?? '',
            cuit_destinatario: obs.match(/Destinatario: [^(]+\(([^)]+)\)/)?.[1]?.trim() ?? '',
            destino: '', cuit_destino: '',
            empresa_transportista: '', cuit_transportista: '',
            representante_entregador: obs.match(/Rep entregador: ([^(]+)/)?.[1]?.trim() ?? '',
            cuit_rep_entregador: obs.match(/Rep entregador: [^(]+\(([^)]+)\)/)?.[1]?.trim() ?? '',
            representante_recibidor: '', cuit_rep_recibidor: '',
            intermediario_flete: '', cuit_intermediario: '',
            chofer_nombre: obs.match(/Chofer: ([^C]+)CUIL/)?.[1]?.trim() ?? '',
            chofer_cuil: obs.match(/CUIL: ([^\|]+)/)?.[1]?.trim() ?? '',
            flete_pagador: obs.match(/Flete pagador: ([^\|]+)/)?.[1]?.trim() ?? 'BARATZA SRL',
            lote_id: carta.lote_id ?? '',
            peso_bruto_kg: obs.match(/Peso bruto: (\d+)/)?.[1] ?? '',
            peso_tara_kg: obs.match(/Tara: (\d+)/)?.[1] ?? '',
            toneladas_origen: carta.toneladas_origen ? String(carta.toneladas_origen) : '',
            declaracion_calidad: obs.match(/Calidad: ([^\|]+)/)?.[1]?.trim() ?? 'conforme',
            humedad_origen: carta.humedad_origen ? String(carta.humedad_origen) : '',
            proteina: carta.proteina ? String(carta.proteina) : '',
            gluten: carta.gluten ? String(carta.gluten) : '',
            peso_hectolitrico: carta.peso_hectolitrico ? String(carta.peso_hectolitrico) : '',
            zaranda: carta.zaranda ? String(carta.zaranda) : '',
            procedencia_localidad: obs.match(/Procedencia: ([^,]+)/)?.[1]?.trim() ?? 'TRES LOMAS',
            procedencia_provincia: obs.match(/Procedencia: [^,]+, ([^\|]+)/)?.[1]?.trim() ?? 'BUENOS AIRES',
            renspa: obs.match(/RENSPA: ([^\|]+)/)?.[1]?.trim() ?? '',
            descripcion_campo: obs.match(/Campo: ([^\|]+)/)?.[1]?.trim() ?? '',
            latitud: obs.match(/Coords: ([^/]+)/)?.[1]?.trim() ?? '',
            longitud: obs.match(/Coords: [^/]+\/ ([^\|]+)/)?.[1]?.trim() ?? '',
            origen_acopio_id: carta.origen_acopio_id ?? '',
            destino_acopio_id: carta.destino_acopio_id ?? '',
            destino_localidad: obs.match(/Destino: ([^,]+)/)?.[1]?.trim() ?? '',
            destino_provincia: obs.match(/Destino: [^,]+, ([^\|]+)/)?.[1]?.trim() ?? '',
            nro_planta: obs.match(/N° Planta: ([^\|]+)/)?.[1]?.trim() ?? '',
            destino_direccion: obs.match(/Dir destino: ([^\|]+)/)?.[1]?.trim() ?? '',
            patente_camion: obs.match(/Patentes: ([^-]+)/)?.[1]?.trim() ?? '',
            patente_acoplado: obs.match(/Patentes: [^-]+ - ([^\|]+)/)?.[1]?.trim() ?? '',
            fecha_partida: carta.fecha_partida ?? '',
            hora_partida: carta.hora_partida ?? '',
            km_recorrer: obs.match(/Km: ([^\|]+)/)?.[1]?.trim() ?? '',
            tarifa_flete: obs.match(/Tarifa flete: ([^\|]+)/)?.[1]?.trim() ?? '',
            fecha_arribo: obs.match(/Arribo: ([^\|]+)/)?.[1]?.trim() ?? '',
            fecha_descarga: obs.match(/Descarga: ([^\|]+)/)?.[1]?.trim() ?? '',
            nro_turno: obs.match(/N° Turno: ([^\|]+)/)?.[1]?.trim() ?? '',
            peso_bruto_destino: obs.match(/Peso bruto destino: (\d+)/)?.[1] ?? '',
            peso_tara_destino: obs.match(/Tara: (\d+)kg\s*\|/)?.[1] ?? '',
            humedad_destino: carta.humedad_destino ? String(carta.humedad_destino) : '',
            observaciones: '',
            bonificacion_calidad: carta.bonificacion_calidad ? String(carta.bonificacion_calidad) : '',
            estado: carta.estado ?? 'emitida',
          })
        }
      }
      setLoading(false)
    }
    load()
  }, [numeroCpe])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  const pesoNeto = form.peso_bruto_kg && form.peso_tara_kg
    ? (parseFloat(form.peso_bruto_kg) - parseFloat(form.peso_tara_kg)) / 1000 : null

  const pesoNetoDestino = form.peso_bruto_destino && form.peso_tara_destino
    ? (parseFloat(form.peso_bruto_destino) - parseFloat(form.peso_tara_destino)) / 1000 : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const toneladas = pesoNeto ?? (form.toneladas_origen ? parseFloat(form.toneladas_origen) : 0)
    const extras = []
    if (form.fecha_vencimiento) extras.push(`Venc: ${form.fecha_vencimiento}`)
    if (form.renspa) extras.push(`RENSPA: ${form.renspa}`)
    if (form.cuit_titular) extras.push(`CUIT Titular: ${form.cuit_titular}`)
    if (form.remitente_comercial) extras.push(`Remitente: ${form.remitente_comercial} (${form.cuit_remitente})`)
    if (form.destinatario) extras.push(`Destinatario: ${form.destinatario} (${form.cuit_destinatario})`)
    if (form.representante_entregador) extras.push(`Rep entregador: ${form.representante_entregador} (${form.cuit_rep_entregador})`)
    if (form.flete_pagador) extras.push(`Flete pagador: ${form.flete_pagador}`)
    if (form.chofer_nombre) extras.push(`Chofer: ${form.chofer_nombre} CUIL: ${form.chofer_cuil}`)
    if (form.declaracion_calidad) extras.push(`Calidad: ${form.declaracion_calidad}`)
    if (form.peso_bruto_kg) extras.push(`Peso bruto: ${form.peso_bruto_kg}kg | Tara: ${form.peso_tara_kg}kg`)
    if (form.procedencia_localidad) extras.push(`Procedencia: ${form.procedencia_localidad}, ${form.procedencia_provincia}`)
    if (form.descripcion_campo) extras.push(`Campo: ${form.descripcion_campo}`)
    if (form.latitud) extras.push(`Coords: ${form.latitud} / ${form.longitud}`)
    if (form.destino_localidad) extras.push(`Destino: ${form.destino_localidad}, ${form.destino_provincia}`)
    if (form.nro_planta) extras.push(`N° Planta: ${form.nro_planta}`)
    if (form.destino_direccion) extras.push(`Dir destino: ${form.destino_direccion}`)
    if (form.patente_camion) extras.push(`Patentes: ${form.patente_camion} - ${form.patente_acoplado}`)
    if (form.km_recorrer) extras.push(`Km: ${form.km_recorrer}`)
    if (form.tarifa_flete) extras.push(`Tarifa flete: ${form.tarifa_flete}`)
    if (form.nro_turno) extras.push(`N° Turno: ${form.nro_turno}`)
    if (form.fecha_arribo) extras.push(`Arribo: ${form.fecha_arribo}`)
    if (form.fecha_descarga) extras.push(`Descarga: ${form.fecha_descarga}`)
    if (form.peso_bruto_destino) extras.push(`Peso bruto destino: ${form.peso_bruto_destino}kg | Tara: ${form.peso_tara_destino}kg`)

    const payload: any = {
      numero_cpe: form.numero_cpe,
      campania_id: form.campania_id,
      cultivo_id: form.cultivo_id,
      fecha_emision: form.fecha_emision,
      toneladas_origen: toneladas,
      estado: form.estado,
      observaciones: [...extras, form.observaciones].filter(Boolean).join(' | '),
    }
    if (form.ctg) payload.ctg = form.ctg
    if (form.lote_id) payload.lote_id = form.lote_id
    if (form.contrato_id) payload.contrato_id = form.contrato_id
    else payload.contrato_id = null
    if (form.fecha_partida) payload.fecha_partida = form.fecha_partida
    if (form.hora_partida) payload.hora_partida = form.hora_partida
    if (form.humedad_origen) payload.humedad_origen = parseFloat(form.humedad_origen)
    if (form.humedad_destino) payload.humedad_destino = parseFloat(form.humedad_destino)
    if (form.proteina) payload.proteina = parseFloat(form.proteina)
    if (form.gluten) payload.gluten = parseFloat(form.gluten)
    if (form.peso_hectolitrico) payload.peso_hectolitrico = parseFloat(form.peso_hectolitrico)
    if (form.zaranda) payload.zaranda = parseFloat(form.zaranda)
    if (form.origen_acopio_id) payload.origen_acopio_id = form.origen_acopio_id
    if (form.destino_acopio_id) payload.destino_acopio_id = form.destino_acopio_id
    if (pesoNetoDestino !== null) payload.toneladas_netas = pesoNetoDestino
    if (form.peso_bruto_destino) payload.toneladas_destino = parseFloat(form.peso_bruto_destino) / 1000
    payload.bonificacion_calidad = form.bonificacion_calidad ? parseFloat(form.bonificacion_calidad) : null

    const { error } = await supabase.from('cartas_porte').update(payload).eq('id', cartaId)
    if (error) { setError(error.message); setSaving(false) }
    else { setSuccess(true); setTimeout(() => router.push('/dashboard/cartas-porte'), 1500) }
  }

  const seccion = (letra: string, titulo: string) => (
    <h2 className="font-semibold text-campo-800 mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-campo-600 text-white text-xs flex items-center justify-center font-bold">{letra}</span>
      {titulo}
    </h2>
  )

  if (loading) return <div className="flex items-center justify-center h-40 text-campo-400">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Editar Carta de Porte</h1>
          <p className="text-campo-500 text-sm">CPE {numeroCpe}</p>
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Carta de porte actualizada. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          {seccion('A', 'Identificación CPE')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° CPE *</label><input value={form.numero_cpe} onChange={e => set('numero_cpe', e.target.value)} required className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CTG</label><input value={form.ctg} onChange={e => set('ctg', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha emisión *</label><input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha vencimiento</label><input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label><select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label><select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Contrato vinculado</label><select value={form.contrato_id} onChange={e => set('contrato_id', e.target.value)} className="input-field"><option value="">Sin contrato</option>{contratos.map(c => <option key={c.id} value={c.id}>{c.numero} — {(c.cultivos as any)?.nombre} — {(c.clientes as any)?.razon_social}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Estado</label><select value={form.estado} onChange={e => set('estado', e.target.value)} className="input-field"><option value="emitida">Emitida</option><option value="en_transito">En tránsito</option><option value="descargada">Descargada</option><option value="anulada">Anulada</option></select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Bonificación calidad (%)</label><input type="number" step="0.01" value={form.bonificacion_calidad} onChange={e => set('bonificacion_calidad', e.target.value)} placeholder="2.00" className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('B', 'Intervinientes')}
          <div className="space-y-2">
            {[
              { label: 'Titular Carta de Porte',          cuitKey: 'cuit_titular',            nombreKey: 'razon_social_titular' },
              { label: 'Remitente Comercial Productor',    cuitKey: 'cuit_rte_productor',      nombreKey: 'remitente_comercial_productor' },
              { label: 'Rte. Comercial Venta Primaria',    cuitKey: 'cuit_remitente',          nombreKey: 'remitente_comercial' },
              { label: 'Rte. Comercial Venta Secundaria',  cuitKey: 'cuit_rte_secundaria',     nombreKey: 'remitente_venta_secundaria' },
              { label: 'Rte. Comercial Venta Secundaria 2',cuitKey: 'cuit_rte_secundaria2',    nombreKey: 'remitente_venta_secundaria2' },
              { label: 'Mercado a Término',                cuitKey: 'cuit_mercado_termino',    nombreKey: 'mercado_termino' },
              { label: 'Corredor Venta Primaria',          cuitKey: 'cuit_corredor_primaria',  nombreKey: 'corredor_venta_primaria' },
              { label: 'Corredor Venta Secundaria',        cuitKey: 'cuit_corredor_secundaria',nombreKey: 'corredor_venta_secundaria' },
              { label: 'Representante entregador',         cuitKey: 'cuit_rep_entregador',     nombreKey: 'representante_entregador' },
              { label: 'Representante recibidor',          cuitKey: 'cuit_rep_recibidor',      nombreKey: 'representante_recibidor' },
              { label: 'Destinatario',                     cuitKey: 'cuit_destinatario',       nombreKey: 'destinatario' },
              { label: 'Destino',                          cuitKey: 'cuit_destino',            nombreKey: 'destino' },
              { label: 'Empresa Transportista',            cuitKey: 'cuit_transportista',      nombreKey: 'empresa_transportista' },
              { label: 'Flete pagador',                    cuitKey: 'cuit_flete_pagador',      nombreKey: 'flete_pagador' },
              { label: 'Intermediario de flete',           cuitKey: 'cuit_intermediario',      nombreKey: 'intermediario_flete' },
              { label: 'Chofer',                           cuitKey: 'chofer_cuil',             nombreKey: 'chofer_nombre' },
            ].map(({ label, cuitKey, nombreKey }) => (
              <div key={label} className="grid grid-cols-12 gap-2 items-center border-b border-campo-50 pb-2">
                <div className="col-span-3 text-sm font-medium text-campo-700">{label}</div>
                <div className="col-span-3"><input value={(form as any)[cuitKey] ?? ''} onChange={e => set(cuitKey, e.target.value)} placeholder="CUIT/CUIL" className="input-field font-mono text-xs" /></div>
                <div className="col-span-6"><input value={(form as any)[nombreKey] ?? ''} onChange={e => set(nombreKey, e.target.value)} placeholder="Razón social" className="input-field text-xs" /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          {seccion('C', 'Grano y Calidad')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-2">Declaración de calidad</label>
              <div className="flex gap-2">{['conforme','condicional'].map(v => <button key={v} type="button" onClick={() => set('declaracion_calidad', v)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${form.declaracion_calidad===v?'bg-campo-600 text-white border-campo-600':'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>{v}</button>)}</div>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Lote de origen</label><select value={form.lote_id} onChange={e => set('lote_id', e.target.value)} className="input-field"><option value="">Sin lote</option>{lotes.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.establecimiento}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Bruto (kg)</label><input type="number" value={form.peso_bruto_kg} onChange={e => set('peso_bruto_kg', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Tara (kg)</label><input type="number" value={form.peso_tara_kg} onChange={e => set('peso_tara_kg', e.target.value)} className="input-field" /></div>
            {pesoNeto !== null && <div className="col-span-2"><div className="rounded-lg bg-campo-50 border border-campo-200 px-4 py-2 text-sm"><span className="text-campo-500">Peso Neto calculado: </span><span className="font-bold text-campo-800">{pesoNeto.toFixed(3)} tn</span></div></div>}
            {!pesoNeto && <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas (manual)</label><input type="number" step="0.001" value={form.toneladas_origen} onChange={e => set('toneladas_origen', e.target.value)} className="input-field" /></div>}
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Humedad origen (%)</label><input type="number" step="0.01" value={form.humedad_origen} onChange={e => set('humedad_origen', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Proteína (%)</label><input type="number" step="0.01" value={form.proteina} onChange={e => set('proteina', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Gluten (%)</label><input type="number" step="0.01" value={form.gluten} onChange={e => set('gluten', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Hectolítrico</label><input type="number" step="0.01" value={form.peso_hectolitrico} onChange={e => set('peso_hectolitrico', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Zaranda (%)</label><input type="number" step="0.01" value={form.zaranda} onChange={e => set('zaranda', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('D', 'Procedencia')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Localidad origen</label><input value={form.procedencia_localidad} onChange={e => set('procedencia_localidad', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Provincia origen</label><input value={form.procedencia_provincia} onChange={e => set('procedencia_provincia', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">RENSPA</label><input value={form.renspa} onChange={e => set('renspa', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Descripción del campo</label><input value={form.descripcion_campo} onChange={e => set('descripcion_campo', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Latitud</label><input value={form.latitud} onChange={e => set('latitud', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Longitud</label><input value={form.longitud} onChange={e => set('longitud', e.target.value)} className="input-field font-mono" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('E', 'Destino')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Acopio origen</label><select value={form.origen_acopio_id} onChange={e => set('origen_acopio_id', e.target.value)} className="input-field"><option value="">Sin acopio</option>{acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Acopio destino</label><select value={form.destino_acopio_id} onChange={e => set('destino_acopio_id', e.target.value)} className="input-field"><option value="">Sin acopio</option>{acopios.map(a => <option key={a.id} value={a.id}>{a.nombre} — {a.localidad}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Localidad destino</label><input value={form.destino_localidad} onChange={e => set('destino_localidad', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Provincia destino</label><input value={form.destino_provincia} onChange={e => set('destino_provincia', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° Planta</label><input value={form.nro_planta} onChange={e => set('nro_planta', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Dirección destino</label><input value={form.destino_direccion} onChange={e => set('destino_direccion', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('F', 'Transporte')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Patente camión</label><input value={form.patente_camion} onChange={e => set('patente_camion', e.target.value.toUpperCase())} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Patente acoplado</label><input value={form.patente_acoplado} onChange={e => set('patente_acoplado', e.target.value.toUpperCase())} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha de partida</label><input type="date" value={form.fecha_partida} onChange={e => set('fecha_partida', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Hora de partida</label><input type="time" value={form.hora_partida} onChange={e => set('hora_partida', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Km a recorrer</label><input type="number" value={form.km_recorrer} onChange={e => set('km_recorrer', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Tarifa flete ($/tn)</label><input type="number" step="0.01" value={form.tarifa_flete} onChange={e => set('tarifa_flete', e.target.value)} className="input-field" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('G', 'Descarga')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha arribo</label><input type="date" value={form.fecha_arribo} onChange={e => set('fecha_arribo', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha descarga</label><input type="date" value={form.fecha_descarga} onChange={e => set('fecha_descarga', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° Turno</label><input value={form.nro_turno} onChange={e => set('nro_turno', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Humedad destino (%)</label><input type="number" step="0.01" value={form.humedad_destino} onChange={e => set('humedad_destino', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Bruto destino (kg)</label><input type="number" value={form.peso_bruto_destino} onChange={e => set('peso_bruto_destino', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Tara destino (kg)</label><input type="number" value={form.peso_tara_destino} onChange={e => set('peso_tara_destino', e.target.value)} className="input-field" /></div>
            {pesoNetoDestino !== null && <div className="col-span-2"><div className="rounded-lg bg-campo-50 border border-campo-200 px-4 py-2 text-sm"><span className="text-campo-500">Peso Neto destino calculado: </span><span className="font-bold text-campo-800">{pesoNetoDestino.toFixed(3)} tn</span></div></div>}
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones adicionales</label>
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