'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campania = { id: number; nombre: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }

type FeedlotIngreso = {
  id: string; categoria_id: string; campania: string
  cantidad_cabezas: number; fecha_entrada: string; observaciones: string | null
  categorias_hacienda: { nombre: string }
}

type FeedlotSalida = {
  id: string; ingreso_id: string; fecha_salida: string
  cantidad_cabezas: number; motivo: string; observaciones: string | null
  precio_por_kg_usd: number | null; peso_promedio_kg: number | null; ingreso_total_usd: number | null
}

type OtroAlimento = { nombre: string; cantidad_tn: number; precio_usd_tn: number }

type FeedlotCarga = {
  id: string; ingreso_id: string; campania: string; fecha_carga: string
  maiz_tn: number; maiz_precio_usd_tn: number
  nucleo_tn: number; nucleo_precio_usd_tn: number
  expeller_tn: number; expeller_precio_usd_tn: number
  otros_alimentos: OtroAlimento[] | null
  observaciones: string | null
}

const inputCls = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-stone-700'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">x</button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function diasDesde(fecha: string): number {
  return Math.max(0, Math.round((new Date().getTime() - new Date(fecha + 'T00:00:00').getTime()) / 86400000))
}

function costoTotalCarga(c: FeedlotCarga): number {
  const base = c.maiz_tn * c.maiz_precio_usd_tn + c.nucleo_tn * c.nucleo_precio_usd_tn + c.expeller_tn * c.expeller_precio_usd_tn
  const otros = (c.otros_alimentos ?? []).reduce((s, o) => s + o.cantidad_tn * o.precio_usd_tn, 0)
  return base + otros
}

function mezclaTotalCarga(c: FeedlotCarga): number {
  const base = c.maiz_tn + c.nucleo_tn + c.expeller_tn
  const otros = (c.otros_alimentos ?? []).reduce((s, o) => s + o.cantidad_tn, 0)
  return base + otros
}

export default function FeedlotPage() {
  const supabase = createClient()
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [ingresos, setIngresos] = useState<FeedlotIngreso[]>([])
  const [cargando, setCargando] = useState(true)
  const [ingresoSel, setIngresoSel] = useState<FeedlotIngreso | null>(null)
  const [salidas, setSalidas] = useState<FeedlotSalida[]>([])
  const [cargas, setCargas] = useState<FeedlotCarga[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  // Formulario ingreso
  const [iCategoriaId, setICategoriaId] = useState('')
  const [iCampania, setICampania] = useState('')
  const [iCabezas, setICabezas] = useState('')
  const [iFechaEntrada, setIFechaEntrada] = useState(new Date().toISOString().slice(0, 10))
  const [iObs, setIObs] = useState('')
  const [iGuardando, setIGuardando] = useState(false)
  const [iError, setIError] = useState<string | null>(null)
  const [iExito, setIExito] = useState<string | null>(null)

  // Formulario salida
  const [showSalida, setShowSalida] = useState(false)
  const [sFechaSalida, setSFechaSalida] = useState(new Date().toISOString().slice(0, 10))
  const [sCabezas, setSCabezas] = useState('')
  const [sMotivo, setSMotivo] = useState('venta')
  const [sPrecioPorKg, setSPrecioPorKg] = useState('')
  const [sPesoPromedio, setSPesoPromedio] = useState('')
  const [sObs, setSObs] = useState('')
  const [sGuardando, setSGuardando] = useState(false)
  const [sError, setSError] = useState<string | null>(null)

  // Formulario carga
  const [showCarga, setShowCarga] = useState(false)
  const [cFecha, setCFecha] = useState(new Date().toISOString().slice(0, 10))
  const [cMaizTn, setCMaizTn] = useState('')
  const [cMaizPrecio, setCMaizPrecio] = useState('')
  const [cNucleoTn, setCNucleoTn] = useState('')
  const [cNucleoPrecio, setCNucleoPrecio] = useState('')
  const [cExpellerTn, setCExpellerTn] = useState('')
  const [cExpellerPrecio, setCExpellerPrecio] = useState('')
  const [cOtros, setCOtros] = useState<OtroAlimento[]>([])
  const [cObs, setCObs] = useState('')
  const [cGuardando, setCGuardando] = useState(false)
  const [cError, setCError] = useState<string | null>(null)
  const [cExito, setCExito] = useState<string | null>(null)

  // Modal editar carga
  const [editCarga, setEditCarga] = useState<FeedlotCarga | null>(null)
  const [ecFecha, setEcFecha] = useState('')
  const [ecMaizTn, setEcMaizTn] = useState('')
  const [ecMaizPrecio, setEcMaizPrecio] = useState('')
  const [ecNucleoTn, setEcNucleoTn] = useState('')
  const [ecNucleoPrecio, setEcNucleoPrecio] = useState('')
  const [ecExpellerTn, setEcExpellerTn] = useState('')
  const [ecExpellerPrecio, setEcExpellerPrecio] = useState('')
  const [ecOtros, setEcOtros] = useState<OtroAlimento[]>([])
  const [ecObs, setEcObs] = useState('')
  const [ecGuardando, setEcGuardando] = useState(false)
  const [ecError, setEcError] = useState<string | null>(null)

  // Modal editar salida
  const [editSalida, setEditSalida] = useState<FeedlotSalida | null>(null)
  const [esFechaSalida, setEsFechaSalida] = useState('')
  const [esCabezas, setEsCabezas] = useState('')
  const [esMotivo, setEsMotivo] = useState('venta')
  const [esPrecioPorKg, setEsPrecioPorKg] = useState('')
  const [esPesoPromedio, setEsPesoPromedio] = useState('')
  const [esObs, setEsObs] = useState('')
  const [esGuardando, setEsGuardando] = useState(false)
  const [esError, setEsError] = useState<string | null>(null)

  // Modal editar ingreso
  const [editIngreso, setEditIngreso] = useState<FeedlotIngreso | null>(null)
  const [eiCabezas, setEiCabezas] = useState('')
  const [eiObs, setEiObs] = useState('')
  const [eiGuardando, setEiGuardando] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: camp }, { data: cat }] = await Promise.all([
        supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
      ])
      setCampanias(camp ?? [])
      setCategorias(cat ?? [])
    }
    cargar(); cargarIngresos()
  }, [])

  const cargarIngresos = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('feedlot_ingresos')
      .select('*, categorias_hacienda(nombre)')
      .order('fecha_entrada', { ascending: false })
    setIngresos((data ?? []) as FeedlotIngreso[])
    setCargando(false)
  }

  const cargarDetalle = async (ingreso: FeedlotIngreso) => {
    setIngresoSel(ingreso)
    const [{ data: sal }, { data: car }] = await Promise.all([
      supabase.from('feedlot_salidas').select('*').eq('ingreso_id', ingreso.id).order('fecha_salida'),
      supabase.from('feedlot_cargas').select('*').eq('ingreso_id', ingreso.id).order('fecha_carga'),
    ])
    setSalidas((sal ?? []) as FeedlotSalida[])
    setCargas((car ?? []) as FeedlotCarga[])
    setShowSalida(false); setShowCarga(false)
    setSError(null); setCError(null); setCExito(null)
  }

  const cabezasActivas = (ingreso: FeedlotIngreso, salidasLote: FeedlotSalida[]) =>
    ingreso.cantidad_cabezas - salidasLote.reduce((s, x) => s + x.cantidad_cabezas, 0)

  // ---- Submit ingreso ----
  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault(); setIError(null); setIExito(null)
    if (!iCategoriaId) return setIError('Seleccioná una categoría.')
    if (!iCampania) return setIError('Seleccioná una campaña.')
    if (!iCabezas || Number(iCabezas) <= 0) return setIError('Ingresá la cantidad de cabezas.')
    setIGuardando(true)
    try {
      const { error } = await supabase.from('feedlot_ingresos').insert({
        categoria_id: iCategoriaId, campania: iCampania,
        cantidad_cabezas: Number(iCabezas), fecha_entrada: iFechaEntrada,
        observaciones: iObs || null,
      })
      if (error) throw error
      setIExito('Ingreso registrado.')
      setICategoriaId(''); setICampania(''); setICabezas(''); setIObs('')
      cargarIngresos()
    } catch (err: any) { setIError(err.message) }
    finally { setIGuardando(false) }
  }

  // ---- Submit salida ----
  const handleSubmitSalida = async (e: React.FormEvent) => {
    e.preventDefault(); setSError(null)
    if (!ingresoSel) return
    const activas = cabezasActivas(ingresoSel, salidas)
    if (!sCabezas || Number(sCabezas) <= 0) return setSError('Ingresá la cantidad.')
    if (Number(sCabezas) > activas) return setSError(`Solo hay ${activas} cabezas activas.`)
    if (sMotivo === 'venta' && (!sPrecioPorKg || !sPesoPromedio)) return setSError('Para una venta ingresá precio por kg y peso promedio.')
    setSGuardando(true)
    try {
      const cabezas = Number(sCabezas)
      const precioPorKg = sMotivo === 'venta' ? Number(sPrecioPorKg) : null
      const pesoPromedio = sMotivo === 'venta' ? Number(sPesoPromedio) : null
      const ingresoTotal = precioPorKg && pesoPromedio ? cabezas * pesoPromedio * precioPorKg : null
      const { error } = await supabase.from('feedlot_salidas').insert({
        ingreso_id: ingresoSel.id, fecha_salida: sFechaSalida,
        cantidad_cabezas: cabezas, motivo: sMotivo,
        precio_por_kg_usd: precioPorKg, peso_promedio_kg: pesoPromedio,
        ingreso_total_usd: ingresoTotal,
        observaciones: sObs || null,
      })
      if (error) throw error
      setSCabezas(''); setSObs(''); setSPrecioPorKg(''); setSPesoPromedio('')
      setShowSalida(false)
      cargarDetalle(ingresoSel); setRefreshKey(k => k + 1); cargarIngresos()
    } catch (err: any) { setSError(err.message) }
    finally { setSGuardando(false) }
  }

  // ---- Submit carga ----
  const handleSubmitCarga = async (e: React.FormEvent) => {
    e.preventDefault(); setCError(null); setCExito(null)
    if (!ingresoSel) return
    const tieneAlgo = Number(cMaizTn) > 0 || Number(cNucleoTn) > 0 || Number(cExpellerTn) > 0 || cOtros.some(o => o.cantidad_tn > 0)
    if (!tieneAlgo) return setCError('Ingresá al menos un alimento.')
    setCGuardando(true)
    try {
      const { error } = await supabase.from('feedlot_cargas').insert({
        ingreso_id: ingresoSel.id, campania: ingresoSel.campania, fecha_carga: cFecha,
        maiz_tn: Number(cMaizTn) || 0, maiz_precio_usd_tn: Number(cMaizPrecio) || 0,
        nucleo_tn: Number(cNucleoTn) || 0, nucleo_precio_usd_tn: Number(cNucleoPrecio) || 0,
        expeller_tn: Number(cExpellerTn) || 0, expeller_precio_usd_tn: Number(cExpellerPrecio) || 0,
        otros_alimentos: cOtros.filter(o => o.cantidad_tn > 0).length > 0
          ? cOtros.filter(o => o.cantidad_tn > 0) : null,
        observaciones: cObs || null,
      })
      if (error) throw error
      setCExito('Carga registrada.')
      setCMaizTn(''); setCMaizPrecio(''); setCNucleoTn(''); setCNucleoPrecio('')
      setCExpellerTn(''); setCExpellerPrecio(''); setCOtros([]); setCObs('')
      cargarDetalle(ingresoSel)
    } catch (err: any) { setCError(err.message) }
    finally { setCGuardando(false) }
  }

  const agregarOtroAlimento = () => setCOtros(prev => [...prev, { nombre: '', cantidad_tn: 0, precio_usd_tn: 0 }])
  const actualizarOtro = (i: number, campo: keyof OtroAlimento, valor: string) => {
    setCOtros(prev => prev.map((o, idx) => idx === i ? { ...o, [campo]: campo === 'nombre' ? valor : Number(valor) } : o))
  }
  const quitarOtro = (i: number) => setCOtros(prev => prev.filter((_, idx) => idx !== i))

  const handleGuardarEditIngreso = async () => {
    if (!editIngreso) return
    setEiGuardando(true)
    const { error } = await supabase.from('feedlot_ingresos').update({
      cantidad_cabezas: Number(eiCabezas) || editIngreso.cantidad_cabezas,
      observaciones: eiObs || null,
    }).eq('id', editIngreso.id)
    if (!error) {
      setEditIngreso(null); cargarIngresos()
      if (ingresoSel?.id === editIngreso.id) cargarDetalle({ ...editIngreso, cantidad_cabezas: Number(eiCabezas) || editIngreso.cantidad_cabezas })
    }
    setEiGuardando(false)
  }

  const abrirEditCarga = (c: FeedlotCarga) => {
    setEditCarga(c); setEcFecha(c.fecha_carga)
    setEcMaizTn(String(c.maiz_tn)); setEcMaizPrecio(String(c.maiz_precio_usd_tn))
    setEcNucleoTn(String(c.nucleo_tn)); setEcNucleoPrecio(String(c.nucleo_precio_usd_tn))
    setEcExpellerTn(String(c.expeller_tn)); setEcExpellerPrecio(String(c.expeller_precio_usd_tn))
    setEcOtros(c.otros_alimentos ?? []); setEcObs(c.observaciones ?? ''); setEcError(null)
  }

  const handleGuardarEditCarga = async () => {
    if (!editCarga || !ingresoSel) return; setEcError(null)
    setEcGuardando(true)
    try {
      const { error } = await supabase.from('feedlot_cargas').update({
        fecha_carga: ecFecha,
        maiz_tn: Number(ecMaizTn) || 0, maiz_precio_usd_tn: Number(ecMaizPrecio) || 0,
        nucleo_tn: Number(ecNucleoTn) || 0, nucleo_precio_usd_tn: Number(ecNucleoPrecio) || 0,
        expeller_tn: Number(ecExpellerTn) || 0, expeller_precio_usd_tn: Number(ecExpellerPrecio) || 0,
        otros_alimentos: ecOtros.filter(o => o.cantidad_tn > 0).length > 0 ? ecOtros.filter(o => o.cantidad_tn > 0) : null,
        observaciones: ecObs || null,
      }).eq('id', editCarga.id)
      if (error) throw error
      setEditCarga(null); cargarDetalle(ingresoSel)
    } catch (err: any) { setEcError(err.message) }
    finally { setEcGuardando(false) }
  }

  const abrirEditSalida = (s: FeedlotSalida) => {
    setEditSalida(s); setEsFechaSalida(s.fecha_salida); setEsCabezas(String(s.cantidad_cabezas))
    setEsMotivo(s.motivo); setEsPrecioPorKg(s.precio_por_kg_usd ? String(s.precio_por_kg_usd) : '')
    setEsPesoPromedio(s.peso_promedio_kg ? String(s.peso_promedio_kg) : '')
    setEsObs(s.observaciones ?? ''); setEsError(null)
  }

  const handleGuardarEditSalida = async () => {
    if (!editSalida || !ingresoSel) return; setEsError(null)
    setEsGuardando(true)
    try {
      const precioPorKg = esMotivo === 'venta' && esPrecioPorKg ? Number(esPrecioPorKg) : null
      const pesoPromedio = esMotivo === 'venta' && esPesoPromedio ? Number(esPesoPromedio) : null
      const ingresoTotal = precioPorKg && pesoPromedio ? Number(esCabezas) * pesoPromedio * precioPorKg : null
      const { error } = await supabase.from('feedlot_salidas').update({
        fecha_salida: esFechaSalida, cantidad_cabezas: Number(esCabezas),
        motivo: esMotivo, precio_por_kg_usd: precioPorKg,
        peso_promedio_kg: pesoPromedio, ingreso_total_usd: ingresoTotal,
        observaciones: esObs || null,
      }).eq('id', editSalida.id)
      if (error) throw error
      setEditSalida(null); cargarDetalle(ingresoSel); setRefreshKey(k => k + 1)
    } catch (err: any) { setEsError(err.message) }
    finally { setEsGuardando(false) }
  }

  const handleBorrarIngreso = async (id: string) => {
    if (!confirm('¿Borrar este ingreso y todas sus cargas y salidas?')) return
    await supabase.from('feedlot_ingresos').delete().eq('id', id)
    if (ingresoSel?.id === id) setIngresoSel(null)
    cargarIngresos()
  }

  const handleBorrarSalida = async (id: string) => {
    if (!confirm('¿Borrar esta salida?')) return
    await supabase.from('feedlot_salidas').delete().eq('id', id)
    if (ingresoSel) cargarDetalle(ingresoSel)
  }

  const handleBorrarCarga = async (id: string) => {
    if (!confirm('¿Borrar esta carga?')) return
    await supabase.from('feedlot_cargas').delete().eq('id', id)
    if (ingresoSel) cargarDetalle(ingresoSel)
  }

  // KPIs
  const totalMezclaTn = cargas.reduce((s, c) => s + mezclaTotalCarga(c), 0)
  const costoRacion = cargas.reduce((s, c) => s + costoTotalCarga(c), 0)
  const cabActivas = ingresoSel ? cabezasActivas(ingresoSel, salidas) : 0
  const diasFeedlot = ingresoSel ? diasDesde(ingresoSel.fecha_entrada) : 0
  // Consumo/cab/día: total mezcla en kg ÷ días ÷ cabezas ingresadas originalmente
  const consumoPorCabDia = ingresoSel && ingresoSel.cantidad_cabezas > 0 && diasFeedlot > 0
    ? (totalMezclaTn * 1000) / ingresoSel.cantidad_cabezas / diasFeedlot : 0
  const totalIngresoVentas = salidas.filter(s => s.motivo === 'venta' && s.ingreso_total_usd)
    .reduce((s, x) => s + (x.ingreso_total_usd ?? 0), 0)
  const resultadoNeto = totalIngresoVentas - costoRacion

  // Preview salida venta
  const ingresoTotalPreview = sMotivo === 'venta' && sCabezas && sPrecioPorKg && sPesoPromedio
    ? Number(sCabezas) * Number(sPesoPromedio) * Number(sPrecioPorKg) : null

  // Preview carga
  const totalMezclaForm = (Number(cMaizTn)||0) + (Number(cNucleoTn)||0) + (Number(cExpellerTn)||0) + cOtros.reduce((s,o) => s + o.cantidad_tn, 0)
  const costoTotalForm = (Number(cMaizTn)||0)*(Number(cMaizPrecio)||0) + (Number(cNucleoTn)||0)*(Number(cNucleoPrecio)||0) + (Number(cExpellerTn)||0)*(Number(cExpellerPrecio)||0) + cOtros.reduce((s,o) => s + o.cantidad_tn * o.precio_usd_tn, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Feedlot</h1>
        <p className="text-sm text-stone-500">Ingresos de hacienda, cargas de ración y salidas por venta o muerte.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        {/* ---- Panel izquierdo ---- */}
        <div className="space-y-4">
          <form onSubmit={handleSubmitIngreso} className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
            <h2 className="text-base font-semibold text-stone-900">Nuevo ingreso al feedlot</h2>
            {iError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{iError}</div>}
            {iExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{iExito}</div>}

            <div><label className={labelCls}>Campaña</label>
              <select value={iCampania} onChange={e => setICampania(e.target.value)} className={inputCls}>
                <option value="">Seleccionar campaña...</option>
                {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Categoría</label>
              <select value={iCategoriaId} onChange={e => setICategoriaId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar categoría...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Cabezas que ingresan</label>
              <input type="number" min={1} value={iCabezas} onChange={e => setICabezas(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Fecha de entrada</label>
              <input type="date" value={iFechaEntrada} onChange={e => setIFechaEntrada(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={iObs} onChange={e => setIObs(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={iGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {iGuardando ? 'Guardando...' : 'Registrar ingreso'}
            </button>
          </form>

          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <div className="bg-stone-50 px-4 py-3 border-b border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900">Ingresos registrados</h3>
            </div>
            {cargando && <p className="px-4 py-3 text-sm text-stone-500">Cargando...</p>}
            {!cargando && ingresos.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Sin ingresos registrados.</p>}
            <div className="divide-y divide-stone-100">
              {ingresos.map(i => (
                <div key={i.id} onClick={() => cargarDetalle(i)}
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${ingresoSel?.id === i.id ? 'bg-stone-100' : 'hover:bg-stone-50'}`}>
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{i.categorias_hacienda?.nombre}</div>
                    <div className="text-xs text-stone-500">{i.campania} · {i.cantidad_cabezas} cab. · {new Date(i.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}</div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2">
                    <button onClick={ev => { ev.stopPropagation(); setEditIngreso(i); setEiCabezas(String(i.cantidad_cabezas)); setEiObs(i.observaciones ?? '') }}
                      className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                    <button onClick={ev => { ev.stopPropagation(); handleBorrarIngreso(i.id) }}
                      className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Panel derecho ---- */}
        <div key={refreshKey}>
          {!ingresoSel ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-stone-300">
              <p className="text-sm text-stone-400">Seleccioná un ingreso para ver el detalle</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header con KPIs */}
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">{ingresoSel.categorias_hacienda?.nombre}</h2>
                    <p className="text-sm text-stone-500">Campaña {ingresoSel.campania} · Entrada: {new Date(ingresoSel.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')} · {diasFeedlot} días</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-stone-900">{cabActivas}</div>
                    <div className="text-xs text-stone-500">cabezas activas</div>
                    <div className="text-xs text-stone-400">de {ingresoSel.cantidad_cabezas} ingresadas</div>
                  </div>
                </div>

                {cargas.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Mezcla total</p>
                      <p className="text-base font-bold text-stone-900">{fmt(totalMezclaTn, 3)} tn</p>
                    </div>
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Consumo/cab/día</p>
                      <p className="text-base font-bold text-stone-900">{fmt(consumoPorCabDia, 1)} kg</p>
                      <p className="text-xs text-stone-400">kg de alimento por cabeza por día</p>
                    </div>
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Costo ración</p>
                      <p className="text-base font-bold text-stone-900">USD {fmt(costoRacion)}</p>
                      {ingresoSel.cantidad_cabezas > 0 && <p className="text-xs text-stone-400">USD {fmt(costoRacion / ingresoSel.cantidad_cabezas)}/cab</p>}
                    </div>
                    <div className={`rounded-md p-3 ${resultadoNeto >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-stone-500">Resultado neto</p>
                      <p className={`text-base font-bold ${resultadoNeto >= 0 ? 'text-green-700' : 'text-red-700'}`}>USD {fmt(resultadoNeto)}</p>
                      <p className="text-xs text-stone-400">Ventas - Ración</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setShowCarga(v => !v); setShowSalida(false) }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${showCarga ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                    + Carga de ración
                  </button>
                  <button onClick={() => { setShowSalida(v => !v); setShowCarga(false) }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${showSalida ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-700 hover:bg-stone-50'}`}>
                    + Registrar salida
                  </button>
                </div>
              </div>

              {/* Formulario carga */}
              {showCarga && (
                <form onSubmit={handleSubmitCarga} className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
                  <h3 className="text-base font-semibold text-stone-900">Nueva carga de ración</h3>
                  {cError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cError}</div>}
                  {cExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{cExito}</div>}

                  <div><label className={labelCls}>Fecha de carga</label>
                    <input type="date" value={cFecha} onChange={e => setCFecha(e.target.value)} className={inputCls} /></div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 rounded-md bg-stone-50 p-3">
                      <p className="text-xs font-semibold text-stone-600 uppercase">Maíz</p>
                      <div><label className={labelCls}>Toneladas</label>
                        <input type="number" min={0} step="0.001" value={cMaizTn} onChange={e => setCMaizTn(e.target.value)} className={inputCls} /></div>
                      <div><label className={labelCls}>Precio (USD/tn)</label>
                        <input type="number" min={0} step="0.01" value={cMaizPrecio} onChange={e => setCMaizPrecio(e.target.value)} className={inputCls} /></div>
                    </div>
                    <div className="space-y-3 rounded-md bg-stone-50 p-3">
                      <p className="text-xs font-semibold text-stone-600 uppercase">Núcleo</p>
                      <div><label className={labelCls}>Toneladas</label>
                        <input type="number" min={0} step="0.001" value={cNucleoTn} onChange={e => setCNucleoTn(e.target.value)} className={inputCls} /></div>
                      <div><label className={labelCls}>Precio (USD/tn)</label>
                        <input type="number" min={0} step="0.01" value={cNucleoPrecio} onChange={e => setCNucleoPrecio(e.target.value)} className={inputCls} /></div>
                    </div>
                  </div>

                  <details className="rounded-md border border-stone-200 p-3">
                    <summary className="text-xs font-semibold text-stone-500 cursor-pointer">Expeller (opcional)</summary>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div><label className={labelCls}>Toneladas</label>
                        <input type="number" min={0} step="0.001" value={cExpellerTn} onChange={e => setCExpellerTn(e.target.value)} className={inputCls} /></div>
                      <div><label className={labelCls}>Precio (USD/tn)</label>
                        <input type="number" min={0} step="0.01" value={cExpellerPrecio} onChange={e => setCExpellerPrecio(e.target.value)} className={inputCls} /></div>
                    </div>
                  </details>

                  {/* Otros alimentos */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-stone-600 uppercase">Otros alimentos</p>
                      <button type="button" onClick={agregarOtroAlimento} className="text-xs text-stone-500 underline hover:text-stone-900">+ Agregar</button>
                    </div>
                    {cOtros.map((o, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end rounded-md bg-amber-50 p-3">
                        <div><label className={labelCls}>Nombre (ej: Rollo, Silo)</label>
                          <input value={o.nombre} onChange={e => actualizarOtro(i, 'nombre', e.target.value)} placeholder="Ej: Rollo" className={inputCls} /></div>
                        <div><label className={labelCls}>Tn</label>
                          <input type="number" min={0} step="0.001" value={o.cantidad_tn || ''} onChange={e => actualizarOtro(i, 'cantidad_tn', e.target.value)} className="w-24 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" /></div>
                        <div><label className={labelCls}>USD/tn</label>
                          <input type="number" min={0} step="0.01" value={o.precio_usd_tn || ''} onChange={e => actualizarOtro(i, 'precio_usd_tn', e.target.value)} className="w-24 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" /></div>
                        <button type="button" onClick={() => quitarOtro(i)} className="mb-0.5 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                      </div>
                    ))}
                  </div>

                  {totalMezclaForm > 0 && (
                    <div className="rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-600">
                      Total mezcla: <span className="font-medium">{fmt(totalMezclaForm, 3)} tn</span> · Costo: <span className="font-medium">USD {fmt(costoTotalForm)}</span>
                    </div>
                  )}

                  <div><label className={labelCls}>Observaciones</label>
                    <textarea value={cObs} onChange={e => setCObs(e.target.value)} rows={2} className={inputCls} /></div>

                  <button type="submit" disabled={cGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
                    {cGuardando ? 'Guardando...' : 'Registrar carga'}
                  </button>
                </form>
              )}

              {/* Formulario salida */}
              {showSalida && (
                <form onSubmit={handleSubmitSalida} className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
                  <h3 className="text-base font-semibold text-stone-900">Registrar salida</h3>
                  <p className="text-sm text-stone-500">Cabezas activas: <span className="font-semibold text-stone-900">{cabActivas}</span></p>
                  {sError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sError}</div>}

                  <div><label className={labelCls}>Fecha de salida</label>
                    <input type="date" value={sFechaSalida} onChange={e => setSFechaSalida(e.target.value)} className={inputCls} /></div>

                  <div><label className={labelCls}>Cantidad de cabezas</label>
                    <input type="number" min={1} max={cabActivas} value={sCabezas} onChange={e => setSCabezas(e.target.value)} className={inputCls} /></div>

                  <div><label className={labelCls}>Motivo</label>
                    <select value={sMotivo} onChange={e => { setSMotivo(e.target.value); setSPrecioPorKg(''); setSPesoPromedio('') }} className={inputCls}>
                      <option value="venta">Venta</option>
                      <option value="muerte">Muerte</option>
                      <option value="otro">Otro</option>
                    </select></div>

                  {sMotivo === 'venta' && (
                    <div className="space-y-3 rounded-md bg-green-50 p-3">
                      <p className="text-xs font-semibold text-stone-600 uppercase">Datos de la venta</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelCls}>Peso promedio/cab (kg)</label>
                          <input type="number" min={0} step="0.1" value={sPesoPromedio} onChange={e => setSPesoPromedio(e.target.value)} placeholder="Ej: 380" className={inputCls} /></div>
                        <div><label className={labelCls}>Precio (USD/kg)</label>
                          <input type="number" min={0} step="0.001" value={sPrecioPorKg} onChange={e => setSPrecioPorKg(e.target.value)} placeholder="Ej: 1.85" className={inputCls} /></div>
                      </div>
                      {ingresoTotalPreview && (
                        <div className="rounded-md bg-green-100 px-3 py-2 text-xs text-green-800 space-y-0.5">
                          <div>Peso total: <span className="font-medium">{fmt(Number(sCabezas) * Number(sPesoPromedio), 0)} kg</span></div>
                          <div>Ingreso total: <span className="font-bold text-base">USD {fmt(ingresoTotalPreview)}</span></div>
                          <div>Por cabeza: <span className="font-medium">USD {fmt(ingresoTotalPreview / Number(sCabezas))}</span></div>
                        </div>
                      )}
                    </div>
                  )}

                  <div><label className={labelCls}>Observaciones</label>
                    <textarea value={sObs} onChange={e => setSObs(e.target.value)} rows={2} className={inputCls} /></div>

                  <button type="submit" disabled={sGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
                    {sGuardando ? 'Guardando...' : 'Registrar salida'}
                  </button>
                </form>
              )}

              {/* Historial cargas */}
              {cargas.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-stone-900">Cargas de ración</h3>
                  <div className="overflow-hidden rounded-lg border border-stone-200">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 text-right font-medium">Maíz</th>
                        <th className="px-3 py-2 text-right font-medium">Núcleo</th>
                        <th className="px-3 py-2 text-right font-medium">Otros</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        <th className="px-3 py-2 text-right font-medium">Costo USD</th>
                        <th className="px-3 py-2" />
                      </tr></thead>
                      <tbody>
                        {cargas.map(c => (
                          <tr key={c.id} className="border-t border-stone-100">
                            <td className="px-3 py-2 text-stone-700">{new Date(c.fecha_carga + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                            <td className="px-3 py-2 text-right">{c.maiz_tn > 0 ? fmt(c.maiz_tn, 3) + ' tn' : '—'}</td>
                            <td className="px-3 py-2 text-right">{c.nucleo_tn > 0 ? fmt(c.nucleo_tn, 3) + ' tn' : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs text-stone-500">
                              {c.otros_alimentos && c.otros_alimentos.length > 0
                                ? c.otros_alimentos.map(o => `${o.nombre}: ${fmt(o.cantidad_tn, 3)}`).join(', ')
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{fmt(mezclaTotalCarga(c), 3)} tn</td>
                            <td className="px-3 py-2 text-right font-medium text-stone-900">USD {fmt(costoTotalCarga(c))}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => abrirEditCarga(c)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                                <button onClick={() => handleBorrarCarga(c.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Historial salidas */}
              {salidas.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-stone-900">Salidas</h3>
                  <div className="overflow-hidden rounded-lg border border-stone-200">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                        <th className="px-3 py-2 font-medium">Fecha</th>
                        <th className="px-3 py-2 text-right font-medium">Cabezas</th>
                        <th className="px-3 py-2 font-medium">Motivo</th>
                        <th className="px-3 py-2 text-right font-medium">Peso prom.</th>
                        <th className="px-3 py-2 text-right font-medium">USD/kg</th>
                        <th className="px-3 py-2 text-right font-medium">Ingreso</th>
                        <th className="px-3 py-2" />
                      </tr></thead>
                      <tbody>
                        {salidas.map(s => (
                          <tr key={s.id} className="border-t border-stone-100">
                            <td className="px-3 py-2 text-stone-700">{new Date(s.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                            <td className="px-3 py-2 text-right font-medium">{s.cantidad_cabezas}</td>
                            <td className="px-3 py-2 text-stone-600 capitalize">{s.motivo}</td>
                            <td className="px-3 py-2 text-right">{s.peso_promedio_kg ? fmt(s.peso_promedio_kg, 0) + ' kg' : '—'}</td>
                            <td className="px-3 py-2 text-right">{s.precio_por_kg_usd ? 'USD ' + fmt(s.precio_por_kg_usd, 3) : '—'}</td>
                            <td className="px-3 py-2 text-right font-medium text-green-700">{s.ingreso_total_usd ? 'USD ' + fmt(s.ingreso_total_usd) : '—'}</td>
                            <td className="px-3 py-2">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => abrirEditSalida(s)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                                <button onClick={() => handleBorrarSalida(s.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal editar carga */}
      {editCarga && (
        <Modal title="Editar carga de ración" onClose={() => setEditCarga(null)}>
          {ecError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{ecError}</div>}
          <div><label className={labelCls}>Fecha de carga</label>
            <input type="date" value={ecFecha} onChange={e => setEcFecha(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 rounded-md bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600 uppercase">Maíz</p>
              <div><label className={labelCls}>Toneladas</label>
                <input type="number" min={0} step="0.001" value={ecMaizTn} onChange={e => setEcMaizTn(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Precio (USD/tn)</label>
                <input type="number" min={0} step="0.01" value={ecMaizPrecio} onChange={e => setEcMaizPrecio(e.target.value)} className={inputCls} /></div>
            </div>
            <div className="space-y-2 rounded-md bg-stone-50 p-3">
              <p className="text-xs font-semibold text-stone-600 uppercase">Núcleo</p>
              <div><label className={labelCls}>Toneladas</label>
                <input type="number" min={0} step="0.001" value={ecNucleoTn} onChange={e => setEcNucleoTn(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Precio (USD/tn)</label>
                <input type="number" min={0} step="0.01" value={ecNucleoPrecio} onChange={e => setEcNucleoPrecio(e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <details className="rounded-md border border-stone-200 p-3">
            <summary className="text-xs font-semibold text-stone-500 cursor-pointer">Expeller (opcional)</summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className={labelCls}>Toneladas</label>
                <input type="number" min={0} step="0.001" value={ecExpellerTn} onChange={e => setEcExpellerTn(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Precio (USD/tn)</label>
                <input type="number" min={0} step="0.01" value={ecExpellerPrecio} onChange={e => setEcExpellerPrecio(e.target.value)} className={inputCls} /></div>
            </div>
          </details>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-stone-600 uppercase">Otros alimentos</p>
              <button type="button" onClick={() => setEcOtros(prev => [...prev, { nombre: '', cantidad_tn: 0, precio_usd_tn: 0 }])} className="text-xs text-stone-500 underline hover:text-stone-900">+ Agregar</button>
            </div>
            {ecOtros.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end rounded-md bg-amber-50 p-3">
                <div><label className={labelCls}>Nombre</label>
                  <input value={o.nombre} onChange={e => setEcOtros(prev => prev.map((x, idx) => idx === i ? { ...x, nombre: e.target.value } : x))} className={inputCls} /></div>
                <div><label className={labelCls}>Tn</label>
                  <input type="number" min={0} step="0.001" value={o.cantidad_tn || ''} onChange={e => setEcOtros(prev => prev.map((x, idx) => idx === i ? { ...x, cantidad_tn: Number(e.target.value) } : x))} className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm" /></div>
                <div><label className={labelCls}>USD/tn</label>
                  <input type="number" min={0} step="0.01" value={o.precio_usd_tn || ''} onChange={e => setEcOtros(prev => prev.map((x, idx) => idx === i ? { ...x, precio_usd_tn: Number(e.target.value) } : x))} className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm" /></div>
                <button type="button" onClick={() => setEcOtros(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-lg">×</button>
              </div>
            ))}
          </div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={ecObs} onChange={e => setEcObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditCarga(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditCarga} disabled={ecGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {ecGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal editar salida */}
      {editSalida && (
        <Modal title="Editar salida" onClose={() => setEditSalida(null)}>
          {esError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{esError}</div>}
          <div><label className={labelCls}>Fecha de salida</label>
            <input type="date" value={esFechaSalida} onChange={e => setEsFechaSalida(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={esCabezas} onChange={e => setEsCabezas(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Motivo</label>
            <select value={esMotivo} onChange={e => { setEsMotivo(e.target.value); setEsPrecioPorKg(''); setEsPesoPromedio('') }} className={inputCls}>
              <option value="venta">Venta</option>
              <option value="muerte">Muerte</option>
              <option value="otro">Otro</option>
            </select></div>
          {esMotivo === 'venta' && (
            <div className="space-y-3 rounded-md bg-green-50 p-3">
              <p className="text-xs font-semibold text-stone-600 uppercase">Datos de la venta</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Peso promedio/cab (kg)</label>
                  <input type="number" min={0} step="0.1" value={esPesoPromedio} onChange={e => setEsPesoPromedio(e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Precio (USD/kg)</label>
                  <input type="number" min={0} step="0.001" value={esPrecioPorKg} onChange={e => setEsPrecioPorKg(e.target.value)} className={inputCls} /></div>
              </div>
              {esCabezas && esPrecioPorKg && esPesoPromedio && (
                <div className="rounded-md bg-green-100 px-3 py-2 text-xs text-green-800">
                  Ingreso total: <span className="font-bold">USD {fmt(Number(esCabezas) * Number(esPesoPromedio) * Number(esPrecioPorKg))}</span>
                </div>
              )}
            </div>
          )}
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={esObs} onChange={e => setEsObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditSalida(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditSalida} disabled={esGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {esGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {editIngreso && (
        <Modal title={`Editar — ${editIngreso.categorias_hacienda?.nombre}`} onClose={() => setEditIngreso(null)}>
          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={eiCabezas} onChange={e => setEiCabezas(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={eiObs} onChange={e => setEiObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditIngreso(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditIngreso} disabled={eiGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {eiGuardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
