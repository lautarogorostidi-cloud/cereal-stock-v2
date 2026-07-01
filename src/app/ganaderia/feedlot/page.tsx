'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }

type LoteFeedlot = {
  id: string; numero_lote: string; campo_id: number; categoria_id: string
  cantidad_cabezas: number; fecha_entrada: string; fecha_salida: string | null
  peso_entrada_kg: number; peso_salida_kg: number | null; observaciones: string | null
  campos: { nombre: string }; categorias_hacienda: { nombre: string }
}

type CargaSilo = {
  id: string; lote_feedlot_id: string; fecha_carga: string
  fecha_agotamiento_estimada: string | null
  maiz_tn: number; maiz_precio_usd_tn: number
  expeller_tn: number; expeller_precio_usd_tn: number
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

function fmt(n: number, dec = 3) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function diasEntre(desde: string, hasta: string | null): number {
  const d1 = new Date(desde + 'T00:00:00')
  const d2 = hasta ? new Date(hasta + 'T00:00:00') : new Date()
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000))
}

export default function FeedlotPage() {
  const supabase = createClient()

  const [campos, setCampos] = useState<Campo[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [lotes, setLotes] = useState<LoteFeedlot[]>([])
  const [cargandoLotes, setCargandoLotes] = useState(true)

  const [lNumeroLote, setLNumeroLote] = useState('')
  const [lCampoId, setLCampoId] = useState('')
  const [lCategoriaId, setLCategoriaId] = useState('')
  const [lCabezas, setLCabezas] = useState('')
  const [lFechaEntrada, setLFechaEntrada] = useState(new Date().toISOString().slice(0, 10))
  const [lFechaSalida, setLFechaSalida] = useState('')
  const [lPesoEntrada, setLPesoEntrada] = useState('')
  const [lPesoSalida, setLPesoSalida] = useState('')
  const [lObs, setLObs] = useState('')
  const [lGuardando, setLGuardando] = useState(false)
  const [lError, setLError] = useState<string | null>(null)
  const [lExito, setLExito] = useState<string | null>(null)

  const [loteSeleccionado, setLoteSeleccionado] = useState<LoteFeedlot | null>(null)
  const [cargas, setCargas] = useState<CargaSilo[]>([])
  const [cargandoCargas, setCargandoCargas] = useState(false)

  const [cFechaCarga, setCFechaCarga] = useState(new Date().toISOString().slice(0, 10))
  const [cFechaAgotamiento, setCFechaAgotamiento] = useState('')
  const [cMaizTn, setCMaizTn] = useState('')
  const [cMaizPrecio, setCMaizPrecio] = useState('')
  const [cExpellerTn, setCExpellerTn] = useState('')
  const [cExpellerPrecio, setCExpellerPrecio] = useState('')
  const [cObs, setCObs] = useState('')
  const [cGuardando, setCGuardando] = useState(false)
  const [cError, setCError] = useState<string | null>(null)
  const [cExito, setCExito] = useState<string | null>(null)

  const [editLote, setEditLote] = useState<LoteFeedlot | null>(null)
  const [elFechaSalida, setElFechaSalida] = useState('')
  const [elPesoSalida, setElPesoSalida] = useState('')
  const [elCabezas, setElCabezas] = useState('')
  const [elObs, setElObs] = useState('')
  const [elGuardando, setElGuardando] = useState(false)
  const [elError, setElError] = useState<string | null>(null)

  const [editCarga, setEditCarga] = useState<CargaSilo | null>(null)
  const [ecFechaCarga, setEcFechaCarga] = useState('')
  const [ecFechaAgotamiento, setEcFechaAgotamiento] = useState('')
  const [ecMaizTn, setEcMaizTn] = useState('')
  const [ecMaizPrecio, setEcMaizPrecio] = useState('')
  const [ecExpellerTn, setEcExpellerTn] = useState('')
  const [ecExpellerPrecio, setEcExpellerPrecio] = useState('')
  const [ecObs, setEcObs] = useState('')
  const [ecGuardando, setEcGuardando] = useState(false)
  const [ecError, setEcError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: cat }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
      ])
      setCampos(c ?? []); setCategorias(cat ?? [])
    }
    cargar(); cargarLotes()
  }, [])

  const cargarLotes = async () => {
    setCargandoLotes(true)
    const { data } = await supabase
      .from('lotes_feedlot')
      .select('*, campos(nombre), categorias_hacienda(nombre)')
      .order('fecha_entrada', { ascending: false })
    setLotes((data ?? []) as LoteFeedlot[])
    setCargandoLotes(false)
  }

  const cargarCargas = async (loteId: string) => {
    setCargandoCargas(true)
    const { data } = await supabase
      .from('cargas_silo_feedlot')
      .select('*')
      .eq('lote_feedlot_id', loteId)
      .order('fecha_carga', { ascending: true })
    setCargas((data ?? []) as CargaSilo[])
    setCargandoCargas(false)
  }

  const seleccionarLote = (lote: LoteFeedlot) => {
    setLoteSeleccionado(lote)
    cargarCargas(lote.id)
    setCError(null); setCExito(null)
  }

  const handleSubmitLote = async (e: React.FormEvent) => {
    e.preventDefault(); setLError(null); setLExito(null)
    if (!lNumeroLote.trim()) return setLError('Ingresa el numero de lote.')
    if (!lCampoId) return setLError('Selecciona un campo.')
    if (!lCategoriaId) return setLError('Selecciona una categoria.')
    if (!lCabezas || Number(lCabezas) <= 0) return setLError('Ingresa la cantidad de cabezas.')
    if (!lPesoEntrada || Number(lPesoEntrada) <= 0) return setLError('Ingresa el peso de entrada en kg.')
    setLGuardando(true)
    try {
      const { error: eIns } = await supabase.from('lotes_feedlot').insert({
        numero_lote: lNumeroLote.trim(),
        campo_id: Number(lCampoId),
        categoria_id: lCategoriaId,
        cantidad_cabezas: Number(lCabezas),
        fecha_entrada: lFechaEntrada,
        fecha_salida: lFechaSalida || null,
        peso_entrada_kg: Number(lPesoEntrada),
        peso_salida_kg: lPesoSalida ? Number(lPesoSalida) : null,
        observaciones: lObs || null,
      })
      if (eIns) throw eIns
      setLExito('Lote registrado correctamente.')
      setLNumeroLote(''); setLCampoId(''); setLCategoriaId(''); setLCabezas('')
      setLFechaSalida(''); setLPesoEntrada(''); setLPesoSalida(''); setLObs('')
      cargarLotes()
    } catch (err: any) { setLError(err?.message ?? 'Error al guardar.') }
    finally { setLGuardando(false) }
  }

  const handleSubmitCarga = async (e: React.FormEvent) => {
    e.preventDefault(); setCError(null); setCExito(null)
    if (!loteSeleccionado) return
    if (!cMaizTn && !cExpellerTn) return setCError('Ingresa al menos maiz o expeller.')
    setCGuardando(true)
    try {
      const { error: eIns } = await supabase.from('cargas_silo_feedlot').insert({
        lote_feedlot_id: loteSeleccionado.id,
        fecha_carga: cFechaCarga,
        fecha_agotamiento_estimada: cFechaAgotamiento || null,
        maiz_tn: Number(cMaizTn) || 0,
        maiz_precio_usd_tn: Number(cMaizPrecio) || 0,
        expeller_tn: Number(cExpellerTn) || 0,
        expeller_precio_usd_tn: Number(cExpellerPrecio) || 0,
        observaciones: cObs || null,
      })
      if (eIns) throw eIns
      setCExito('Carga registrada.')
      setCMaizTn(''); setCMaizPrecio(''); setCExpellerTn(''); setCExpellerPrecio('')
      setCFechaAgotamiento(''); setCObs('')
      cargarCargas(loteSeleccionado.id)
    } catch (err: any) { setCError(err?.message ?? 'Error al guardar.') }
    finally { setCGuardando(false) }
  }

  const abrirEditLote = (l: LoteFeedlot) => {
    setEditLote(l)
    setElFechaSalida(l.fecha_salida ?? '')
    setElPesoSalida(l.peso_salida_kg ? String(l.peso_salida_kg) : '')
    setElCabezas(String(l.cantidad_cabezas))
    setElObs(l.observaciones ?? '')
    setElError(null)
  }

  const handleGuardarEditLote = async () => {
    if (!editLote) return; setElError(null)
    setElGuardando(true)
    try {
      const { error: eUp } = await supabase.from('lotes_feedlot').update({
        cantidad_cabezas: Number(elCabezas),
        fecha_salida: elFechaSalida || null,
        peso_salida_kg: elPesoSalida ? Number(elPesoSalida) : null,
        observaciones: elObs || null,
      }).eq('id', editLote.id)
      if (eUp) throw eUp
      setEditLote(null); cargarLotes()
      if (loteSeleccionado?.id === editLote.id) cargarCargas(editLote.id)
    } catch (err: any) { setElError(err?.message ?? 'Error al guardar.') }
    finally { setElGuardando(false) }
  }

  const handleBorrarLote = async (id: string) => {
    if (!confirm('Borrar este lote y todas sus cargas de silo?')) return
    await supabase.from('lotes_feedlot').delete().eq('id', id)
    if (loteSeleccionado?.id === id) setLoteSeleccionado(null)
    cargarLotes()
  }

  const abrirEditCarga = (c: CargaSilo) => {
    setEditCarga(c); setEcFechaCarga(c.fecha_carga)
    setEcFechaAgotamiento(c.fecha_agotamiento_estimada ?? '')
    setEcMaizTn(String(c.maiz_tn)); setEcMaizPrecio(String(c.maiz_precio_usd_tn))
    setEcExpellerTn(String(c.expeller_tn)); setEcExpellerPrecio(String(c.expeller_precio_usd_tn))
    setEcObs(c.observaciones ?? ''); setEcError(null)
  }

  const handleGuardarEditCarga = async () => {
    if (!editCarga) return; setEcError(null)
    setEcGuardando(true)
    try {
      const { error: eUp } = await supabase.from('cargas_silo_feedlot').update({
        fecha_carga: ecFechaCarga,
        fecha_agotamiento_estimada: ecFechaAgotamiento || null,
        maiz_tn: Number(ecMaizTn) || 0,
        maiz_precio_usd_tn: Number(ecMaizPrecio) || 0,
        expeller_tn: Number(ecExpellerTn) || 0,
        expeller_precio_usd_tn: Number(ecExpellerPrecio) || 0,
        observaciones: ecObs || null,
      }).eq('id', editCarga.id)
      if (eUp) throw eUp
      setEditCarga(null)
      if (loteSeleccionado) cargarCargas(loteSeleccionado.id)
    } catch (err: any) { setEcError(err?.message ?? 'Error al guardar.') }
    finally { setEcGuardando(false) }
  }

  const handleBorrarCarga = async (id: string) => {
    if (!confirm('Borrar esta carga de silo?')) return
    await supabase.from('cargas_silo_feedlot').delete().eq('id', id)
    if (loteSeleccionado) cargarCargas(loteSeleccionado.id)
  }

  const calcularKPIs = (lote: LoteFeedlot, cargasLote: CargaSilo[]) => {
    const dias = diasEntre(lote.fecha_entrada, lote.fecha_salida)
    const aumentoTotalKg = lote.peso_salida_kg && lote.peso_salida_kg > lote.peso_entrada_kg
      ? lote.peso_salida_kg - lote.peso_entrada_kg : null
    const aumentoPorCabezaKg = aumentoTotalKg ? aumentoTotalKg / lote.cantidad_cabezas : null
    const gdpKg = aumentoPorCabezaKg && dias > 0 ? aumentoPorCabezaKg / dias : null
    const totalMaizTn = cargasLote.reduce((s, c) => s + c.maiz_tn, 0)
    const totalExpellerTn = cargasLote.reduce((s, c) => s + c.expeller_tn, 0)
    const totalMezclaTn = totalMaizTn + totalExpellerTn
    const costoRacionUSD = cargasLote.reduce((s, c) =>
      s + c.maiz_tn * c.maiz_precio_usd_tn + c.expeller_tn * c.expeller_precio_usd_tn, 0)
    const costoPorCabezaUSD = lote.cantidad_cabezas > 0 ? costoRacionUSD / lote.cantidad_cabezas : 0
    const consumoDiarioTn = dias > 0 ? totalMezclaTn / dias : 0
    const consumoPorCabezaKgDia = lote.cantidad_cabezas > 0 ? (consumoDiarioTn / lote.cantidad_cabezas) * 1000 : 0
    const costoKgAumentoUSD = aumentoTotalKg && aumentoTotalKg > 0 ? costoRacionUSD / aumentoTotalKg : null
    const pctMaiz = totalMezclaTn > 0 ? (totalMaizTn / totalMezclaTn) * 100 : 0
    const pctExpeller = totalMezclaTn > 0 ? (totalExpellerTn / totalMezclaTn) * 100 : 0
    return { dias, aumentoTotalKg, aumentoPorCabezaKg, gdpKg, totalMaizTn, totalExpellerTn, totalMezclaTn, costoRacionUSD, costoPorCabezaUSD, consumoDiarioTn, consumoPorCabezaKgDia, costoKgAumentoUSD, pctMaiz, pctExpeller }
  }

  const kpis = loteSeleccionado ? calcularKPIs(loteSeleccionado, cargas) : null
  const totalMezclaForm = (Number(cMaizTn) || 0) + (Number(cExpellerTn) || 0)
  const costoTotalForm = (Number(cMaizTn) || 0) * (Number(cMaizPrecio) || 0) + (Number(cExpellerTn) || 0) * (Number(cExpellerPrecio) || 0)
  const diasAgotamientoForm = cFechaAgotamiento ? diasEntre(cFechaCarga, cFechaAgotamiento) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Feedlot</h1>
        <p className="text-sm text-stone-500">Gestion de lotes de feedlot, cargas de silo de autoconsumo y KPIs de engorde.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <form onSubmit={handleSubmitLote} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-base font-semibold text-stone-900">Nuevo lote feedlot</h2>
            {lError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{lError}</div>}
            {lExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{lExito}</div>}

            <div><label className={labelCls}>N de lote</label>
              <input value={lNumeroLote} onChange={(e) => setLNumeroLote(e.target.value)} placeholder="Ej: FL-001" className={inputCls} /></div>

            <div><label className={labelCls}>Campo</label>
              <select value={lCampoId} onChange={(e) => setLCampoId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Categoria</label>
              <select value={lCategoriaId} onChange={(e) => setLCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar categoria...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Cantidad de cabezas</label>
              <input type="number" min={1} value={lCabezas} onChange={(e) => setLCabezas(e.target.value)} className={inputCls} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Fecha entrada</label>
                <input type="date" value={lFechaEntrada} onChange={(e) => setLFechaEntrada(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Fecha salida (opc.)</label>
                <input type="date" value={lFechaSalida} onChange={(e) => setLFechaSalida(e.target.value)} min={lFechaEntrada} className={inputCls} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Peso entrada (kg)</label>
                <input type="number" min={0} step="1" value={lPesoEntrada} onChange={(e) => setLPesoEntrada(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Peso salida (kg) (opc.)</label>
                <input type="number" min={0} step="1" value={lPesoSalida} onChange={(e) => setLPesoSalida(e.target.value)} className={inputCls} /></div>
            </div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={lObs} onChange={(e) => setLObs(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={lGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {lGuardando ? 'Guardando...' : 'Crear lote'}
            </button>
          </form>

          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <div className="bg-stone-50 px-4 py-3 border-b border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900">Lotes activos</h3>
            </div>
            {cargandoLotes && <p className="px-4 py-3 text-sm text-stone-500">Cargando...</p>}
            {!cargandoLotes && lotes.length === 0 && <p className="px-4 py-3 text-sm text-stone-500">Sin lotes registrados.</p>}
            {!cargandoLotes && lotes.length > 0 && (
              <div className="divide-y divide-stone-100">
                {lotes.map((l) => (
                  <div key={l.id} onClick={() => seleccionarLote(l)}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${loteSeleccionado?.id === l.id ? 'bg-stone-100' : 'hover:bg-stone-50'}`}>
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{l.numero_lote}</div>
                      <div className="text-xs text-stone-500">{l.campos?.nombre} · {l.categorias_hacienda?.nombre} · {l.cantidad_cabezas} cab.</div>
                      <div className="text-xs text-stone-400">
                        {new Date(l.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}
                        {l.fecha_salida ? ' a ' + new Date(l.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR') : ' (en curso)'}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); abrirEditLote(l) }} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                      <button onClick={(e) => { e.stopPropagation(); handleBorrarLote(l.id) }} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          {!loteSeleccionado ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-stone-300">
              <p className="text-sm text-stone-400">Selecciona un lote para ver el detalle y cargar raciones</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900">Lote {loteSeleccionado.numero_lote}</h2>
                    <p className="text-sm text-stone-500">{loteSeleccionado.campos?.nombre} · {loteSeleccionado.categorias_hacienda?.nombre} · {loteSeleccionado.cantidad_cabezas} cabezas</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Entrada: {new Date(loteSeleccionado.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}
                      {loteSeleccionado.fecha_salida && ' | Salida: ' + new Date(loteSeleccionado.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR')}
                      {' | '}{kpis?.dias} dias {!loteSeleccionado.fecha_salida && '(en curso)'}
                    </p>
                  </div>
                  <div className="text-right text-sm text-stone-500">
                    <div>Peso entrada: <span className="font-medium text-stone-900">{fmt(loteSeleccionado.peso_entrada_kg, 0)} kg</span></div>
                    {loteSeleccionado.peso_salida_kg && (
                      <div>Peso salida: <span className="font-medium text-stone-900">{fmt(loteSeleccionado.peso_salida_kg, 0)} kg</span></div>
                    )}
                  </div>
                </div>

                {kpis && cargas.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Mezcla total</p>
                      <p className="text-base font-bold text-stone-900">{fmt(kpis.totalMezclaTn)} tn</p>
                      <p className="text-xs text-stone-400">{fmt(kpis.pctMaiz, 0)}% maiz · {fmt(kpis.pctExpeller, 0)}% exp.</p>
                    </div>
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Consumo/cab/dia</p>
                      <p className="text-base font-bold text-stone-900">{fmt(kpis.consumoPorCabezaKgDia, 1)} kg</p>
                      <p className="text-xs text-stone-400">{fmt(kpis.consumoDiarioTn)} tn/dia total</p>
                    </div>
                    <div className="rounded-md bg-stone-50 p-3">
                      <p className="text-xs text-stone-500">Costo racion</p>
                      <p className="text-base font-bold text-stone-900">USD {fmt(kpis.costoRacionUSD, 2)}</p>
                      <p className="text-xs text-stone-400">USD {fmt(kpis.costoPorCabezaUSD, 2)}/cab</p>
                    </div>
                    {kpis.gdpKg !== null ? (
                      <div className="rounded-md bg-green-50 p-3">
                        <p className="text-xs text-stone-500">GDP (ganancia diaria)</p>
                        <p className="text-base font-bold text-green-700">{fmt(kpis.gdpKg, 3)} kg/dia</p>
                        {kpis.costoKgAumentoUSD && (
                          <p className="text-xs text-stone-400">USD {fmt(kpis.costoKgAumentoUSD, 3)}/kg aumento</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-md bg-stone-50 p-3">
                        <p className="text-xs text-stone-500">GDP</p>
                        <p className="text-sm text-stone-400 italic mt-1">Sin peso salida</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmitCarga} className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
                <h3 className="text-base font-semibold text-stone-900">Nueva carga de silo</h3>
                {cError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cError}</div>}
                {cExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{cExito}</div>}

                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Fecha de carga</label>
                    <input type="date" value={cFechaCarga} onChange={(e) => setCFechaCarga(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Fecha agotamiento est. (opc.)</label>
                    <input type="date" value={cFechaAgotamiento} onChange={(e) => setCFechaAgotamiento(e.target.value)} min={cFechaCarga} className={inputCls} /></div>
                </div>

                {diasAgotamientoForm !== null && diasAgotamientoForm > 0 && (
                  <p className="text-xs text-stone-500">Duracion estimada: <span className="font-medium">{diasAgotamientoForm} dias</span></p>
                )}

                <div className="rounded-md border border-stone-100 bg-stone-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Maiz</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Toneladas</label>
                      <input type="number" min={0} step="0.001" value={cMaizTn} onChange={(e) => setCMaizTn(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Precio (USD/tn)</label>
                      <input type="number" min={0} step="0.01" value={cMaizPrecio} onChange={(e) => setCMaizPrecio(e.target.value)} className={inputCls} /></div>
                  </div>
                </div>

                <div className="rounded-md border border-stone-100 bg-stone-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Expeller</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Toneladas</label>
                      <input type="number" min={0} step="0.001" value={cExpellerTn} onChange={(e) => setCExpellerTn(e.target.value)} className={inputCls} /></div>
                    <div><label className={labelCls}>Precio (USD/tn)</label>
                      <input type="number" min={0} step="0.01" value={cExpellerPrecio} onChange={(e) => setCExpellerPrecio(e.target.value)} className={inputCls} /></div>
                  </div>
                </div>

                {totalMezclaForm > 0 && (
                  <div className="rounded-md bg-stone-100 px-3 py-2 text-xs text-stone-600 space-y-0.5">
                    <div>Mezcla total: <span className="font-medium">{fmt(totalMezclaForm)} tn</span>
                      {' (' + fmt((Number(cMaizTn)||0)/totalMezclaForm*100, 0) + '% maiz · ' + fmt((Number(cExpellerTn)||0)/totalMezclaForm*100, 0) + '% expeller)'}
                    </div>
                    <div>Costo total: <span className="font-medium">USD {fmt(costoTotalForm, 2)}</span></div>
                    {diasAgotamientoForm && diasAgotamientoForm > 0 && loteSeleccionado.cantidad_cabezas > 0 && (
                      <div>Consumo estimado: <span className="font-medium">{fmt(totalMezclaForm/diasAgotamientoForm*1000/loteSeleccionado.cantidad_cabezas, 1)} kg/cab/dia</span></div>
                    )}
                  </div>
                )}

                <div><label className={labelCls}>Observaciones</label>
                  <textarea value={cObs} onChange={(e) => setCObs(e.target.value)} rows={2} className={inputCls} /></div>

                <button type="submit" disabled={cGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
                  {cGuardando ? 'Guardando...' : 'Registrar carga'}
                </button>
              </form>

              {cargas.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-stone-900">Historial de cargas</h3>
                  <div className="overflow-hidden rounded-lg border border-stone-200">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                        <th className="px-3 py-2 font-medium">Fecha carga</th>
                        <th className="px-3 py-2 font-medium">Agotamiento est.</th>
                        <th className="px-3 py-2 text-right font-medium">Maiz (tn)</th>
                        <th className="px-3 py-2 text-right font-medium">Expeller (tn)</th>
                        <th className="px-3 py-2 text-right font-medium">Total mezcla</th>
                        <th className="px-3 py-2 text-right font-medium">Costo USD</th>
                        <th className="px-3 py-2" />
                      </tr></thead>
                      <tbody>
                        {cargas.map((c) => {
                          const totalMezcla = c.maiz_tn + c.expeller_tn
                          const costo = c.maiz_tn * c.maiz_precio_usd_tn + c.expeller_tn * c.expeller_precio_usd_tn
                          const dias = c.fecha_agotamiento_estimada ? diasEntre(c.fecha_carga, c.fecha_agotamiento_estimada) : null
                          return (
                            <tr key={c.id} className="border-t border-stone-100">
                              <td className="px-3 py-2 text-stone-700">{new Date(c.fecha_carga + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                              <td className="px-3 py-2 text-stone-600">
                                {c.fecha_agotamiento_estimada
                                  ? new Date(c.fecha_agotamiento_estimada + 'T00:00:00').toLocaleDateString('es-AR') + ' (' + dias + 'd)'
                                  : '-'}
                              </td>
                              <td className="px-3 py-2 text-right text-stone-900">{fmt(c.maiz_tn)}</td>
                              <td className="px-3 py-2 text-right text-stone-900">{fmt(c.expeller_tn)}</td>
                              <td className="px-3 py-2 text-right font-medium text-stone-900">{fmt(totalMezcla)}</td>
                              <td className="px-3 py-2 text-right text-stone-900">USD {fmt(costo, 2)}</td>
                              <td className="px-3 py-2">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => abrirEditCarga(c)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                                  <button onClick={() => handleBorrarCarga(c.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editLote && (
        <Modal title={'Editar lote ' + editLote.numero_lote} onClose={() => setEditLote(null)}>
          {elError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{elError}</div>}
          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={elCabezas} onChange={(e) => setElCabezas(e.target.value)} className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Fecha salida (opc.)</label>
              <input type="date" value={elFechaSalida} onChange={(e) => setElFechaSalida(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Peso salida (kg) (opc.)</label>
              <input type="number" min={0} step="1" value={elPesoSalida} onChange={(e) => setElPesoSalida(e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={elObs} onChange={(e) => setElObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditLote(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditLote} disabled={elGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {elGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {editCarga && (
        <Modal title="Editar carga de silo" onClose={() => setEditCarga(null)}>
          {ecError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{ecError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Fecha de carga</label>
              <input type="date" value={ecFechaCarga} onChange={(e) => setEcFechaCarga(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Fecha agotamiento (opc.)</label>
              <input type="date" value={ecFechaAgotamiento} onChange={(e) => setEcFechaAgotamiento(e.target.value)} className={inputCls} /></div>
          </div>
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Maiz</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Toneladas</label>
                <input type="number" min={0} step="0.001" value={ecMaizTn} onChange={(e) => setEcMaizTn(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Precio (USD/tn)</label>
                <input type="number" min={0} step="0.01" value={ecMaizPrecio} onChange={(e) => setEcMaizPrecio(e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Expeller</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Toneladas</label>
                <input type="number" min={0} step="0.001" value={ecExpellerTn} onChange={(e) => setEcExpellerTn(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Precio (USD/tn)</label>
                <input type="number" min={0} step="0.01" value={ecExpellerPrecio} onChange={(e) => setEcExpellerPrecio(e.target.value)} className={inputCls} /></div>
            </div>
          </div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={ecObs} onChange={(e) => setEcObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditCarga(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditCarga} disabled={ecGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {ecGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
