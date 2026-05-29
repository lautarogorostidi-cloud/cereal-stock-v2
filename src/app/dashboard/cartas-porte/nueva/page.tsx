'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NuevaCartaPortePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [campanias, setCampanias] = useState<any[]>([])
  const [cultivos, setCultivos] = useState<any[]>([])
  const [lotes, setLotes] = useState<any[]>([])
  const [acopios, setAcopios] = useState<any[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pdfLoaded, setPdfLoaded] = useState(false)

  const [form, setForm] = useState({
    numero_cpe: '', ctg: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    campania_id: '', cultivo_id: '', contrato_id: '',
    cuit_titular: '30717870944',
    remitente_comercial: '', cuit_remitente: '',
    destinatario: '', cuit_destinatario: '',
    representante_entregador: '', cuit_rep_entregador: '',
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
    fecha_partida: '', km_recorrer: '', tarifa_flete: '',
    fecha_arribo: '', fecha_descarga: '', nro_turno: '',
    peso_bruto_destino: '', peso_tara_destino: '',
    humedad_destino: '', observaciones: '',
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
      if (c.data?.length) setForm(f => ({ ...f, campania_id: c.data!.find((x: any) => x.activa)?.id ?? c.data![0].id }))
    }
    load()
  }, [])

  function set(key: string, value: string) { setForm(f => ({ ...f, [key]: value })) }

  const pesoNeto = form.peso_bruto_kg && form.peso_tara_kg
    ? (parseFloat(form.peso_bruto_kg) - parseFloat(form.peso_tara_kg)) / 1000 : null

  async function handlePDFUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError(null)

    try {
      // Convertir PDF a base64
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      // Llamar a Claude API para extraer datos
      const response = await fetch('/api/extraer-cpe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: 'application/pdf' })
      })

      const result = await response.json()
      if (!result.ok) throw new Error(result.error)
      const extracted = result.data

      // Mapear cultivo a cultivo_id
      const cultivoMatch = cultivos.find((c: any) =>
        c.nombre.toLowerCase().includes(extracted.cultivo?.toLowerCase() ?? '') ||
        extracted.cultivo?.toLowerCase().includes(c.nombre.toLowerCase())
      )

      // Mapear campaña a campania_id
      const campaniaMatch = campanias.find((c: any) =>
        c.nombre.replace('/', '-').includes(extracted.campania ?? '') ||
        extracted.campania?.includes(c.nombre.replace('/', '-'))
      )

      setForm(f => ({
        ...f,
        numero_cpe: extracted.numero_cpe || f.numero_cpe,
        ctg: extracted.ctg || f.ctg,
        fecha_emision: extracted.fecha_emision || f.fecha_emision,
        fecha_vencimiento: extracted.fecha_vencimiento || f.fecha_vencimiento,
        campania_id: campaniaMatch?.id || f.campania_id,
        cultivo_id: cultivoMatch?.id || f.cultivo_id,
        cuit_titular: extracted.cuit_titular || f.cuit_titular,
        remitente_comercial: extracted.remitente_comercial || f.remitente_comercial,
        cuit_remitente: extracted.cuit_remitente || f.cuit_remitente,
        destinatario: extracted.destinatario || f.destinatario,
        cuit_destinatario: extracted.cuit_destinatario || f.cuit_destinatario,
        representante_entregador: extracted.representante_entregador || f.representante_entregador,
        cuit_rep_entregador: extracted.cuit_rep_entregador || f.cuit_rep_entregador,
        chofer_nombre: extracted.chofer_nombre || f.chofer_nombre,
        chofer_cuil: extracted.chofer_cuil || f.chofer_cuil,
        flete_pagador: extracted.flete_pagador || f.flete_pagador,
        peso_bruto_kg: extracted.peso_bruto_kg || f.peso_bruto_kg,
        peso_tara_kg: extracted.peso_tara_kg || f.peso_tara_kg,
        declaracion_calidad: extracted.declaracion_calidad || f.declaracion_calidad,
        humedad_origen: extracted.humedad_origen || f.humedad_origen,
        procedencia_localidad: extracted.procedencia_localidad || f.procedencia_localidad,
        procedencia_provincia: extracted.procedencia_provincia || f.procedencia_provincia,
        renspa: extracted.renspa || f.renspa,
        descripcion_campo: extracted.descripcion_campo || f.descripcion_campo,
        latitud: extracted.latitud || f.latitud,
        longitud: extracted.longitud || f.longitud,
        destino_localidad: extracted.destino_localidad || f.destino_localidad,
        destino_provincia: extracted.destino_provincia || f.destino_provincia,
        nro_planta: extracted.nro_planta || f.nro_planta,
        destino_direccion: extracted.destino_direccion || f.destino_direccion,
        patente_camion: extracted.patente_camion || f.patente_camion,
        patente_acoplado: extracted.patente_acoplado || f.patente_acoplado,
        km_recorrer: extracted.km_recorrer || f.km_recorrer,
        nro_turno: extracted.nro_turno || f.nro_turno,
      }))

      setPdfLoaded(true)
    } catch (err) {
      setError('No se pudo extraer el PDF. Completá los campos manualmente.')
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sin sesión'); setLoading(false); return }

    const toneladas = pesoNeto ?? (form.toneladas_origen ? parseFloat(form.toneladas_origen) : 0)
    const extras = []
    if (form.ctg) extras.push(`CTG: ${form.ctg}`)
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
      estado: 'emitida',
      usuario_id: session.user.id,
      observaciones: [form.observaciones, ...extras].filter(Boolean).join(' | '),
    }
    if (form.lote_id) payload.lote_id = form.lote_id
    if (form.contrato_id) payload.contrato_id = form.contrato_id
    if (form.fecha_partida) payload.fecha_partida = form.fecha_partida.includes('T') ? form.fecha_partida.split('T')[0] : form.fecha_partida
    if (form.humedad_origen) payload.humedad_origen = parseFloat(form.humedad_origen)
    if (form.humedad_destino) payload.humedad_destino = parseFloat(form.humedad_destino)
    if (form.proteina) payload.proteina = parseFloat(form.proteina)
    if (form.gluten) payload.gluten = parseFloat(form.gluten)
    if (form.peso_hectolitrico) payload.peso_hectolitrico = parseFloat(form.peso_hectolitrico)
    if (form.zaranda) payload.zaranda = parseFloat(form.zaranda)
    if (form.origen_acopio_id) payload.origen_acopio_id = form.origen_acopio_id
    if (form.destino_acopio_id) payload.destino_acopio_id = form.destino_acopio_id

    const { error } = await supabase.from('cartas_porte').insert(payload)
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(() => router.push('/dashboard/cartas-porte'), 1500) }
  }

  const seccion = (letra: string, titulo: string) => (
    <h2 className="font-semibold text-campo-800 mb-4 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-campo-600 text-white text-xs flex items-center justify-center font-bold">{letra}</span>
      {titulo}
    </h2>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-campo-500 hover:text-campo-700 text-sm">← Volver</button>
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Nueva Carta de Porte</h1>
          <p className="text-campo-500 text-sm">CPE — Código de Trazabilidad de Granos</p>
        </div>
      </div>

      {/* Subir PDF */}
      <div className={`card border-2 border-dashed ${pdfLoaded ? 'border-campo-400 bg-campo-50' : 'border-campo-200'}`}>
        <div className="text-center py-4">
          {extracting ? (
            <div className="space-y-3">
              <div className="w-10 h-10 border-4 border-campo-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-campo-600 font-medium">Claude está leyendo el PDF...</p>
              <p className="text-campo-400 text-sm">Extrayendo datos automáticamente</p>
            </div>
          ) : pdfLoaded ? (
            <div className="space-y-2">
              <div className="text-3xl">✅</div>
              <p className="text-campo-700 font-medium">PDF procesado — revisá y completá los campos</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-campo-500 text-sm underline">Cargar otro PDF</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-4xl">📄</div>
              <p className="text-campo-700 font-medium">Subí el PDF de la CPE para completar automáticamente</p>
              <p className="text-campo-400 text-sm">Claude va a extraer todos los datos del documento</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary mt-2"
              >
                Seleccionar PDF
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handlePDFUpload}
            className="hidden"
          />
        </div>
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 font-medium">✅ Carta de porte registrada. Redirigiendo...</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          {seccion('A', 'Identificación CPE')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">N° CPE *</label><input value={form.numero_cpe} onChange={e => set('numero_cpe', e.target.value)} required placeholder="00000-00000181" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CTG</label><input value={form.ctg} onChange={e => set('ctg', e.target.value)} placeholder="10132532577" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha emisión *</label><input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} required className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha vencimiento</label><input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Campaña *</label><select value={form.campania_id} onChange={e => set('campania_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{campanias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Cultivo *</label><select value={form.cultivo_id} onChange={e => set('cultivo_id', e.target.value)} required className="input-field"><option value="">Seleccioná</option>{cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-campo-700 mb-1">Contrato vinculado</label><select value={form.contrato_id} onChange={e => set('contrato_id', e.target.value)} className="input-field"><option value="">Sin contrato</option>{contratos.map(c => <option key={c.id} value={c.id}>{c.numero} — {(c.cultivos as any)?.nombre} — {(c.clientes as any)?.razon_social}</option>)}</select></div>
          </div>
        </div>

        <div className="card">
          {seccion('B', 'Intervinientes')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Titular</label><input value={form.cuit_titular} onChange={e => set('cuit_titular', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Remitente Comercial</label><input value={form.remitente_comercial} onChange={e => set('remitente_comercial', e.target.value)} placeholder="FEDEA SA" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Remitente</label><input value={form.cuit_remitente} onChange={e => set('cuit_remitente', e.target.value)} placeholder="30685141694" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Destinatario</label><input value={form.destinatario} onChange={e => set('destinatario', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIT Destinatario</label><input value={form.cuit_destinatario} onChange={e => set('cuit_destinatario', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Representante entregador</label><input value={form.representante_entregador} onChange={e => set('representante_entregador', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">CUIL Rep. entregador</label><input value={form.cuit_rep_entregador} onChange={e => set('cuit_rep_entregador', e.target.value)} className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Flete pagador</label><input value={form.flete_pagador} onChange={e => set('flete_pagador', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Chofer — Nombre</label><input value={form.chofer_nombre} onChange={e => set('chofer_nombre', e.target.value)} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Chofer — CUIL</label><input value={form.chofer_cuil} onChange={e => set('chofer_cuil', e.target.value)} className="input-field font-mono" /></div>
          </div>
        </div>

        <div className="card">
          {seccion('C', 'Grano y Calidad')}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-campo-700 mb-2">Declaración de calidad</label>
              <div className="flex gap-2">{['conforme','condicional'].map(v => <button key={v} type="button" onClick={() => set('declaracion_calidad', v)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${form.declaracion_calidad===v?'bg-campo-600 text-white border-campo-600':'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>{v}</button>)}</div>
            </div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Lote de origen</label><select value={form.lote_id} onChange={e => set('lote_id', e.target.value)} className="input-field"><option value="">Sin lote</option>{lotes.map(l => <option key={l.id} value={l.id}>{l.nombre} — {l.establecimiento}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Bruto (kg)</label><input type="number" value={form.peso_bruto_kg} onChange={e => set('peso_bruto_kg', e.target.value)} placeholder="48500" className="input-field" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Peso Tara (kg)</label><input type="number" value={form.peso_tara_kg} onChange={e => set('peso_tara_kg', e.target.value)} placeholder="18500" className="input-field" /></div>
            {pesoNeto !== null && <div className="col-span-2"><div className="rounded-lg bg-campo-50 border border-campo-200 px-4 py-2 text-sm"><span className="text-campo-500">Peso Neto calculado: </span><span className="font-bold text-campo-800">{pesoNeto.toFixed(3)} tn</span></div></div>}
            {!pesoNeto && <div><label className="block text-sm font-medium text-campo-700 mb-1">Toneladas (manual)</label><input type="number" step="0.001" value={form.toneladas_origen} onChange={e => set('toneladas_origen', e.target.value)} placeholder="30.000" className="input-field" /></div>}
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
            <div><label className="block text-sm font-medium text-campo-700 mb-1">RENSPA</label><input value={form.renspa} onChange={e => set('renspa', e.target.value)} placeholder="06.099.0.00001/00" className="input-field font-mono" /></div>
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
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Patente camión</label><input value={form.patente_camion} onChange={e => set('patente_camion', e.target.value.toUpperCase())} placeholder="AF456OU" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Patente acoplado</label><input value={form.patente_acoplado} onChange={e => set('patente_acoplado', e.target.value.toUpperCase())} placeholder="AF456OT" className="input-field font-mono" /></div>
            <div><label className="block text-sm font-medium text-campo-700 mb-1">Fecha y hora de partida</label><input type="datetime-local" value={form.fecha_partida} onChange={e => set('fecha_partida', e.target.value)} className="input-field" /></div>
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
          </div>
        </div>

        <div className="card">
          <label className="block text-sm font-medium text-campo-700 mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} className="input-field resize-none" />
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={loading} className="btn-primary px-8">{loading ? 'Guardando...' : 'Guardar carta de porte'}</button>
        </div>
      </form>
    </div>
  )
}
