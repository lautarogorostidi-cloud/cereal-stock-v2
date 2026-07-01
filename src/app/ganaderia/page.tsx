'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =====================================================================
// Tipos
// =====================================================================

type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type ProductoVeterinario = { id: string; nombre: string; tipo: string; unidad: string }

type StockRow = {
  campo_id: number; campo_nombre: string; categoria_id: string
  categoria_nombre: string; categoria_orden: number; stock_actual: number
}
type StockPorCampo = { campo_nombre: string; filas: StockRow[]; total: number }

type MovimientoRow = {
  id: string; campo_id: number; categoria_id: string; cantidad: number
  tipo_movimiento: string; fecha: string; precio_cabeza_usd: number | null
  monto_total_usd: number | null; observaciones: string | null
  movimiento_relacionado_id: string | null
  categorias_hacienda: { nombre: string }
  campos: { nombre: string }
}

type Pastoreo = {
  id: string; campo_id: number; lote_id: string; categoria_id: string
  cantidad: number; fecha_entrada: string; fecha_salida: string | null
  observaciones: string | null
  lotes: { nombre: string }; categorias_hacienda: { nombre: string }; campos: { nombre: string }
}

type SanidadRow = {
  id: string; campo_id: number; lote_id: string | null; categoria_id: string | null
  fecha: string; cantidad_animales: number; dosis_por_animal: number; total_producto: number
  observaciones: string | null
  productos_veterinarios: { nombre: string; unidad: string }
  lotes: { nombre: string } | null
  categorias_hacienda: { nombre: string } | null
  campos: { nombre: string }
}

type TipoMovimientoUI = 'compra' | 'venta' | 'nacimiento' | 'muerte' | 'recategorizacion' | 'ajuste_positivo' | 'ajuste_negativo'
const TIPOS_MOVIMIENTO: { value: TipoMovimientoUI; label: string }[] = [
  { value: 'compra', label: 'Compra' }, { value: 'venta', label: 'Venta' },
  { value: 'nacimiento', label: 'Nacimiento' }, { value: 'muerte', label: 'Muerte / Desaparecido' },
  { value: 'recategorizacion', label: 'Recategorización' },
  { value: 'ajuste_positivo', label: 'Ajuste (suma)' }, { value: 'ajuste_negativo', label: 'Ajuste (resta)' },
]
const REQUIERE_PRECIO: string[] = ['compra', 'venta']
const TIPOS_PRODUCTO = ['vacuna', 'antiparasitario', 'antibiotico', 'vitamina', 'otro']
const UNIDADES_PRODUCTO = ['ml', 'cc', 'comprimido', 'dosis', 'g', 'otro']

type Tab = 'movimientos' | 'pastoreo' | 'sanidad'
type PastoreoTab = 'actual' | 'historial'

const inputCls = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-stone-700'

// =====================================================================
// Modal reutilizable
// =====================================================================
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h3 className="text-base font-semibold text-stone-900">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

// =====================================================================
// Página
// =====================================================================
export default function GanaderiaPage() {
  const supabase = createClient()

  // ---- Catálogos ----
  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [productosVet, setProductosVet] = useState<ProductoVeterinario[]>([])

  const [tab, setTab] = useState<Tab>('movimientos')

  // ---- Movimientos ----
  const [campoId, setCampoId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimientoUI>('compra')
  const [categoriaId, setCategoriaId] = useState('')
  const [categoriaDestinoId, setCategoriaDestinoId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [precioCabeza, setPrecioCabeza] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [cargandoMov, setCargandoMov] = useState(true)

  // ---- Modal editar movimiento ----
  const [editMov, setEditMov] = useState<MovimientoRow | null>(null)
  const [emCategoriaId, setEmCategoriaId] = useState('')
  const [emCantidad, setEmCantidad] = useState('')
  const [emPrecio, setEmPrecio] = useState('')
  const [emFecha, setEmFecha] = useState('')
  const [emObs, setEmObs] = useState('')
  const [emGuardando, setEmGuardando] = useState(false)
  const [emError, setEmError] = useState<string | null>(null)

  // ---- Stock ----
  const [stock, setStock] = useState<StockPorCampo[]>([])
  const [cargandoStock, setCargandoStock] = useState(true)
  const [errorStock, setErrorStock] = useState<string | null>(null)

  // ---- Pastoreo ----
  const [pCampoId, setPCampoId] = useState('')
  const [pLoteId, setPLoteId] = useState('')
  const [pCategoriaId, setPCategoriaId] = useState('')
  const [pCantidad, setPCantidad] = useState('')
  const [pFechaEntrada, setPFechaEntrada] = useState(new Date().toISOString().slice(0, 10))
  const [pFechaSalida, setPFechaSalida] = useState('')
  const [pObservaciones, setPObservaciones] = useState('')
  const [pGuardando, setPGuardando] = useState(false)
  const [pError, setPError] = useState<string | null>(null)
  const [pExito, setPExito] = useState<string | null>(null)
  const [pastoreoTab, setPastoreoTab] = useState<PastoreoTab>('actual')
  const [pastoreos, setPastoreos] = useState<Pastoreo[]>([])
  const [cargandoPastoreos, setCargandoPastoreos] = useState(false)

  // ---- Modal editar pastoreo ----
  const [editPast, setEditPast] = useState<Pastoreo | null>(null)
  const [epLoteId, setEpLoteId] = useState('')
  const [epCategoriaId, setEpCategoriaId] = useState('')
  const [epCantidad, setEpCantidad] = useState('')
  const [epFechaEntrada, setEpFechaEntrada] = useState('')
  const [epFechaSalida, setEpFechaSalida] = useState('')
  const [epObs, setEpObs] = useState('')
  const [epGuardando, setEpGuardando] = useState(false)
  const [epError, setEpError] = useState<string | null>(null)

  // ---- Sanidad ----
  const [sCampoId, setSCampoId] = useState('')
  const [sLoteId, setSLoteId] = useState('')
  const [sCategoriaId, setSCategoriaId] = useState('')
  const [sProductoId, setSProductoId] = useState('')
  const [sFecha, setSFecha] = useState(new Date().toISOString().slice(0, 10))
  const [sCantidadAnimales, setSCantidadAnimales] = useState('')
  const [sDosisPorAnimal, setSDosisPorAnimal] = useState('')
  const [sObservaciones, setSObservaciones] = useState('')
  const [sGuardando, setSGuardando] = useState(false)
  const [sError, setSError] = useState<string | null>(null)
  const [sExito, setSExito] = useState<string | null>(null)
  const [sanidades, setSanidades] = useState<SanidadRow[]>([])
  const [cargandoSanidad, setCargandoSanidad] = useState(false)
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [npNombre, setNpNombre] = useState('')
  const [npTipo, setNpTipo] = useState('vacuna')
  const [npUnidad, setNpUnidad] = useState('ml')
  const [npGuardando, setNpGuardando] = useState(false)

  // =====================================================================
  // Carga de datos
  // =====================================================================
  useEffect(() => {
    const cargarCatalogos = async () => {
      const [{ data: camposData }, { data: lotesData }, { data: categoriasData }, { data: productosData }] =
        await Promise.all([
          supabase.from('campos').select('id, nombre').order('nombre'),
          supabase.from('lotes').select('id, nombre, establecimiento').eq('activo', true).order('nombre'),
          supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
          supabase.from('productos_veterinarios').select('id, nombre, tipo, unidad').eq('activo', true).order('nombre'),
        ])
      setCampos(camposData ?? [])
      setLotes(lotesData ?? [])
      setCategorias(categoriasData ?? [])
      setProductosVet(productosData ?? [])
    }
    cargarCatalogos()
  }, [supabase])

  const cargarStock = async () => {
    setCargandoStock(true); setErrorStock(null)
    const { data, error: eq } = await supabase.from('vw_stock_hacienda').select('*').order('campo_nombre').order('categoria_orden')
    if (eq) { setErrorStock(eq.message); setCargandoStock(false); return }
    const filas = (data ?? []) as StockRow[]
    const agrupado = new Map<string, StockPorCampo>()
    for (const fila of filas) {
      if (fila.stock_actual === 0) continue
      if (!agrupado.has(fila.campo_nombre)) agrupado.set(fila.campo_nombre, { campo_nombre: fila.campo_nombre, filas: [], total: 0 })
      const g = agrupado.get(fila.campo_nombre)!
      g.filas.push(fila); g.total += fila.stock_actual
    }
    setStock(Array.from(agrupado.values())); setCargandoStock(false)
  }

  const cargarMovimientos = async () => {
    setCargandoMov(true)
    const { data } = await supabase
      .from('movimientos_hacienda')
      .select('*, categorias_hacienda(nombre), campos(nombre)')
      .not('tipo_movimiento', 'in', '(recategorizacion_alta)')
      .order('fecha', { ascending: false })
      .limit(50)
    setMovimientos((data ?? []) as MovimientoRow[])
    setCargandoMov(false)
  }

  const cargarPastoreos = async (soloActivos: boolean) => {
    setCargandoPastoreos(true)
    let q = supabase.from('pastoreos').select('*, lotes(nombre), categorias_hacienda(nombre), campos(nombre)').order('fecha_entrada', { ascending: false })
    if (soloActivos) q = q.is('fecha_salida', null)
    const { data } = await q
    setPastoreos((data ?? []) as Pastoreo[]); setCargandoPastoreos(false)
  }

  const cargarSanidad = async () => {
    setCargandoSanidad(true)
    const { data } = await supabase
      .from('sanidad_hacienda')
      .select('*, productos_veterinarios(nombre, unidad), lotes(nombre), categorias_hacienda(nombre), campos(nombre)')
      .order('fecha', { ascending: false })
    setSanidades((data ?? []) as SanidadRow[]); setCargandoSanidad(false)
  }

  useEffect(() => { cargarStock(); cargarMovimientos() }, [])
  useEffect(() => { cargarPastoreos(pastoreoTab === 'actual') }, [pastoreoTab])
  useEffect(() => { if (tab === 'sanidad') cargarSanidad() }, [tab])

  // ---- Lotes filtrados por campo (usando establecimiento) ----
  const nombreCampo = (id: string) => campos.find((c) => c.id === Number(id))?.nombre ?? ''
  const lotesPorCampo = (campoIdStr: string) =>
    campoIdStr ? lotes.filter((l) => l.establecimiento === nombreCampo(campoIdStr)) : lotes

  // =====================================================================
  // Acciones movimientos
  // =====================================================================
  const esRecategorizacion = tipo === 'recategorizacion'
  const requierePrecio = REQUIERE_PRECIO.includes(tipo)

  const handleSubmitMov = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!campoId) return setError('Seleccioná un campo.')
    if (!categoriaId) return setError('Seleccioná una categoría.')
    if (esRecategorizacion && !categoriaDestinoId) return setError('Seleccioná la categoría destino.')
    if (esRecategorizacion && categoriaDestinoId === categoriaId) return setError('Las categorías deben ser distintas.')
    if (!cantidad || Number(cantidad) <= 0) return setError('Ingresá una cantidad mayor a 0.')
    if (REQUIERE_PRECIO.includes(tipo) && (!precioCabeza || Number(precioCabeza) <= 0)) return setError('Ingresá un precio por cabeza válido.')
    setGuardando(true)
    try {
      const cantNum = Number(cantidad)
      const precioNum = REQUIERE_PRECIO.includes(tipo) ? Number(precioCabeza) : null
      if (esRecategorizacion) {
        const { data: baja, error: eBaja } = await supabase.from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantNum, tipo_movimiento: 'recategorizacion_baja', fecha, observaciones: observaciones || null })
          .select('id').single()
        if (eBaja || !baja) throw eBaja ?? new Error('Error en la baja.')
        const { data: alta, error: eAlta } = await supabase.from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaDestinoId, cantidad: cantNum, tipo_movimiento: 'recategorizacion_alta', fecha, observaciones: observaciones || null, movimiento_relacionado_id: baja.id })
          .select('id').single()
        if (eAlta || !alta) { await supabase.from('movimientos_hacienda').delete().eq('id', baja.id); throw eAlta ?? new Error('Error en la alta.') }
        await supabase.from('movimientos_hacienda').update({ movimiento_relacionado_id: alta.id }).eq('id', baja.id)
      } else {
        const { error: eIns } = await supabase.from('movimientos_hacienda').insert({ campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantNum, tipo_movimiento: tipo, fecha, precio_cabeza_usd: precioNum, observaciones: observaciones || null })
        if (eIns) throw eIns
      }
      setExito('Movimiento registrado.'); setCategoriaId(''); setCategoriaDestinoId(''); setCantidad(''); setPrecioCabeza(''); setObservaciones('')
      cargarStock(); cargarMovimientos()
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
  }

  const abrirEditMov = (m: MovimientoRow) => {
    setEditMov(m); setEmCategoriaId(m.categoria_id); setEmCantidad(String(m.cantidad))
    setEmPrecio(m.precio_cabeza_usd ? String(m.precio_cabeza_usd) : ''); setEmFecha(m.fecha); setEmObs(m.observaciones ?? ''); setEmError(null)
  }

  const handleGuardarEditMov = async () => {
    if (!editMov) return
    setEmError(null)
    if (!emCantidad || Number(emCantidad) <= 0) return setEmError('Ingresá una cantidad válida.')
    if (REQUIERE_PRECIO.includes(editMov.tipo_movimiento) && (!emPrecio || Number(emPrecio) <= 0)) return setEmError('Ingresá un precio válido.')
    setEmGuardando(true)
    try {
      const { error: eUp } = await supabase.from('movimientos_hacienda').update({
        categoria_id: emCategoriaId, cantidad: Number(emCantidad),
        precio_cabeza_usd: REQUIERE_PRECIO.includes(editMov.tipo_movimiento) ? Number(emPrecio) : null,
        fecha: emFecha, observaciones: emObs || null,
      }).eq('id', editMov.id)
      if (eUp) throw eUp
      setEditMov(null); cargarStock(); cargarMovimientos()
    } catch (err: any) { setEmError(err?.message ?? 'Error al guardar.') }
    finally { setEmGuardando(false) }
  }

  const handleBorrarMov = async (m: MovimientoRow) => {
    if (!confirm(`¿Borrar este movimiento de ${m.cantidad} cabezas (${m.tipo_movimiento})?`)) return
    // Si es recategorización, borrar también el movimiento relacionado
    if (m.movimiento_relacionado_id) {
      await supabase.from('movimientos_hacienda').delete().eq('id', m.movimiento_relacionado_id)
    }
    await supabase.from('movimientos_hacienda').delete().eq('id', m.id)
    cargarStock(); cargarMovimientos()
  }

  // =====================================================================
  // Acciones pastoreo
  // =====================================================================
  const handleSubmitPastoreo = async (e: React.FormEvent) => {
    e.preventDefault(); setPError(null); setPExito(null)
    if (!pCampoId) return setPError('Seleccioná un campo.')
    if (!pLoteId) return setPError('Seleccioná un lote.')
    if (!pCategoriaId) return setPError('Seleccioná una categoría.')
    if (!pCantidad || Number(pCantidad) <= 0) return setPError('Ingresá una cantidad mayor a 0.')
    if (pFechaSalida && pFechaSalida < pFechaEntrada) return setPError('La fecha de salida debe ser posterior.')
    setPGuardando(true)
    try {
      const { error: eIns } = await supabase.from('pastoreos').insert({ campo_id: Number(pCampoId), lote_id: pLoteId, categoria_id: pCategoriaId, cantidad: Number(pCantidad), fecha_entrada: pFechaEntrada, fecha_salida: pFechaSalida || null, observaciones: pObservaciones || null })
      if (eIns) throw eIns
      setPExito('Pastoreo registrado.'); setPLoteId(''); setPCategoriaId(''); setPCantidad(''); setPFechaSalida(''); setPObservaciones('')
      cargarPastoreos(pastoreoTab === 'actual')
    } catch (err: any) { setPError(err?.message ?? 'Error al guardar.') }
    finally { setPGuardando(false) }
  }

  const abrirEditPast = (p: Pastoreo) => {
    setEditPast(p); setEpLoteId(p.lote_id); setEpCategoriaId(p.categoria_id)
    setEpCantidad(String(p.cantidad)); setEpFechaEntrada(p.fecha_entrada)
    setEpFechaSalida(p.fecha_salida ?? ''); setEpObs(p.observaciones ?? ''); setEpError(null)
  }

  const handleGuardarEditPast = async () => {
    if (!editPast) return
    setEpError(null)
    if (!epLoteId) return setEpError('Seleccioná un lote.')
    if (!epCantidad || Number(epCantidad) <= 0) return setEpError('Ingresá una cantidad válida.')
    if (epFechaSalida && epFechaSalida < epFechaEntrada) return setEpError('La fecha de salida debe ser posterior.')
    setEpGuardando(true)
    try {
      const { error: eUp } = await supabase.from('pastoreos').update({
        lote_id: epLoteId, categoria_id: epCategoriaId, cantidad: Number(epCantidad),
        fecha_entrada: epFechaEntrada, fecha_salida: epFechaSalida || null, observaciones: epObs || null,
      }).eq('id', editPast.id)
      if (eUp) throw eUp
      setEditPast(null); cargarPastoreos(pastoreoTab === 'actual')
    } catch (err: any) { setEpError(err?.message ?? 'Error al guardar.') }
    finally { setEpGuardando(false) }
  }

  const handleBorrarPast = async (id: string) => {
    if (!confirm('¿Borrar este registro de pastoreo?')) return
    await supabase.from('pastoreos').delete().eq('id', id)
    cargarPastoreos(pastoreoTab === 'actual')
  }

  const registrarSalida = async (id: string) => {
    await supabase.from('pastoreos').update({ fecha_salida: new Date().toISOString().slice(0, 10) }).eq('id', id)
    cargarPastoreos(pastoreoTab === 'actual')
  }

  // =====================================================================
  // Acciones sanidad
  // =====================================================================
  const handleSubmitSanidad = async (e: React.FormEvent) => {
    e.preventDefault(); setSError(null); setSExito(null)
    if (!sCampoId) return setSError('Seleccioná un campo.')
    if (!sProductoId) return setSError('Seleccioná un producto.')
    if (!sCantidadAnimales || Number(sCantidadAnimales) <= 0) return setSError('Ingresá la cantidad de animales.')
    if (!sDosisPorAnimal || Number(sDosisPorAnimal) <= 0) return setSError('Ingresá la dosis por animal.')
    setSGuardando(true)
    try {
      const { error: eIns } = await supabase.from('sanidad_hacienda').insert({ campo_id: Number(sCampoId), lote_id: sLoteId || null, categoria_id: sCategoriaId || null, producto_id: sProductoId, fecha: sFecha, cantidad_animales: Number(sCantidadAnimales), dosis_por_animal: Number(sDosisPorAnimal), observaciones: sObservaciones || null })
      if (eIns) throw eIns
      setSExito('Aplicación registrada.'); setSLoteId(''); setSCategoriaId(''); setSProductoId(''); setSCantidadAnimales(''); setSDosisPorAnimal(''); setSObservaciones('')
      cargarSanidad()
    } catch (err: any) { setSError(err?.message ?? 'Error al guardar.') }
    finally { setSGuardando(false) }
  }

  const handleGuardarProducto = async () => {
    if (!npNombre.trim()) return
    setNpGuardando(true)
    const { data, error: eIns } = await supabase.from('productos_veterinarios').insert({ nombre: npNombre.trim(), tipo: npTipo, unidad: npUnidad }).select('id, nombre, tipo, unidad').single()
    if (!eIns && data) {
      setProductosVet((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSProductoId(data.id); setNpNombre(''); setNpTipo('vacuna'); setNpUnidad('ml'); setShowNuevoProducto(false)
    }
    setNpGuardando(false)
  }

  const productoSeleccionado = productosVet.find((p) => p.id === sProductoId)
  const totalProducto = Number(sCantidadAnimales) * Number(sDosisPorAnimal)

  const LABEL_TIPO: Record<string, string> = {
    compra: 'Compra', venta: 'Venta', nacimiento: 'Nacimiento', muerte: 'Muerte',
    recategorizacion_baja: 'Recategorización', ajuste_positivo: 'Ajuste (+)', ajuste_negativo: 'Ajuste (−)',
  }

  // =====================================================================
  // Render
  // =====================================================================
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Ganadería</h1>
        <p className="text-sm text-stone-500">Stock de hacienda, movimientos, pastoreo y sanidad.</p>
      </div>

      <div className="flex gap-1 border-b border-stone-200">
        {([['movimientos', 'Movimientos'], ['pastoreo', 'Pastoreo por lote'], ['sanidad', 'Sanidad']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === t ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ================================================================ MOVIMIENTOS ================================================================ */}
      {tab === 'movimientos' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmitMov} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Nuevo movimiento</h2>
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

            <div><label className={labelCls}>Campo</label>
              <select value={campoId} onChange={(e) => setCampoId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Tipo de movimiento</label>
              <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMovimientoUI); setCategoriaDestinoId(''); setPrecioCabeza('') }} className={inputCls}>
                {TIPOS_MOVIMIENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>

            <div><label className={labelCls}>{esRecategorizacion ? 'Categoría origen' : 'Categoría'}</label>
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            {esRecategorizacion && (
              <div><label className={labelCls}>Categoría destino</label>
                <select value={categoriaDestinoId} onChange={(e) => setCategoriaDestinoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar categoría...</option>
                  {categorias.filter((c) => c.id !== categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select></div>
            )}

            <div><label className={labelCls}>Cantidad de cabezas</label>
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} /></div>

            {requierePrecio && (
              <div><label className={labelCls}>Precio por cabeza (USD)</label>
                <input type="number" min={0} step="0.01" value={precioCabeza} onChange={(e) => setPrecioCabeza(e.target.value)} className={inputCls} />
                {cantidad && precioCabeza && <p className="mt-1 text-xs text-stone-500">Total: USD {(Number(cantidad) * Number(precioCabeza)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>}
              </div>
            )}

            <div><label className={labelCls}>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar movimiento'}</button>
          </form>

          <div className="space-y-6">
            {/* Stock */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-stone-900">Stock actual</h2>
              {cargandoStock && <p className="text-sm text-stone-500">Cargando...</p>}
              {!cargandoStock && errorStock && <p className="text-sm text-red-600">{errorStock}</p>}
              {!cargandoStock && !errorStock && stock.length === 0 && <p className="text-sm text-stone-500">Sin cabezas registradas.</p>}
              {!cargandoStock && stock.length > 0 && (
                <div className="space-y-4">
                  {stock.map((grupo) => (
                    <div key={grupo.campo_nombre} className="overflow-hidden rounded-lg border border-stone-200">
                      <div className="flex items-center justify-between bg-stone-50 px-4 py-2">
                        <span className="text-sm font-semibold text-stone-900">{grupo.campo_nombre}</span>
                        <span className="text-sm text-stone-500">{grupo.total.toLocaleString('es-AR')} cabezas</span>
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          {grupo.filas.map((f) => (
                            <tr key={f.categoria_id} className="border-t border-stone-100">
                              <td className="px-4 py-1.5 text-stone-700">{f.categoria_nombre}</td>
                              <td className="px-4 py-1.5 text-right font-medium text-stone-900">{f.stock_actual.toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial movimientos */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-stone-900">Últimos movimientos</h2>
              {cargandoMov && <p className="text-sm text-stone-500">Cargando...</p>}
              {!cargandoMov && movimientos.length === 0 && <p className="text-sm text-stone-500">Sin movimientos registrados.</p>}
              {!cargandoMov && movimientos.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 font-medium">Campo</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 font-medium">Categoría</th>
                      <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                      <th className="px-4 py-2 text-right font-medium">USD/cab</th>
                      <th className="px-4 py-2" />
                    </tr></thead>
                    <tbody>
                      {movimientos.map((m) => (
                        <tr key={m.id} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-stone-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                          <td className="px-4 py-2 text-stone-700">{m.campos?.nombre}</td>
                          <td className="px-4 py-2 text-stone-700">{LABEL_TIPO[m.tipo_movimiento] ?? m.tipo_movimiento}</td>
                          <td className="px-4 py-2 text-stone-700">{m.categorias_hacienda?.nombre}</td>
                          <td className="px-4 py-2 text-right font-medium text-stone-900">{m.cantidad.toLocaleString('es-AR')}</td>
                          <td className="px-4 py-2 text-right text-stone-600">{m.precio_cabeza_usd ? `$${Number(m.precio_cabeza_usd).toLocaleString('es-AR')}` : '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => abrirEditMov(m)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                              <button onClick={() => handleBorrarMov(m)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ PASTOREO ================================================================ */}
      {tab === 'pastoreo' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmitPastoreo} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Registrar pastoreo</h2>
            {pError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pError}</div>}
            {pExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{pExito}</div>}

            <div><label className={labelCls}>Campo</label>
              <select value={pCampoId} onChange={(e) => { setPCampoId(e.target.value); setPLoteId('') }} className={inputCls}>
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Lote</label>
              <select value={pLoteId} onChange={(e) => setPLoteId(e.target.value)} disabled={!pCampoId} className={`${inputCls} disabled:opacity-50`}>
                <option value="">Seleccionar lote...</option>
                {lotesPorCampo(pCampoId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Categoría</label>
              <select value={pCategoriaId} onChange={(e) => setPCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Cantidad de cabezas</label>
              <input type="number" min={1} value={pCantidad} onChange={(e) => setPCantidad(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Fecha de entrada</label>
              <input type="date" value={pFechaEntrada} onChange={(e) => setPFechaEntrada(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Fecha de salida <span className="text-stone-400">(opcional)</span></label>
              <input type="date" value={pFechaSalida} onChange={(e) => setPFechaSalida(e.target.value)} min={pFechaEntrada} className={inputCls} /></div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={pObservaciones} onChange={(e) => setPObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={pGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {pGuardando ? 'Guardando...' : 'Registrar pastoreo'}</button>
          </form>

          <div>
            <div className="mb-3 flex gap-1 border-b border-stone-200">
              {(['actual', 'historial'] as PastoreoTab[]).map((t) => (
                <button key={t} onClick={() => setPastoreoTab(t)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${pastoreoTab === t ? 'border-b-2 border-stone-900 text-stone-900' : 'text-stone-500 hover:text-stone-700'}`}>
                  {t === 'actual' ? 'Ubicación actual' : 'Historial'}
                </button>
              ))}
            </div>
            {cargandoPastoreos && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoPastoreos && pastoreos.length === 0 && <p className="text-sm text-stone-500">Sin registros de pastoreo.</p>}
            {!cargandoPastoreos && pastoreos.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Campo / Lote</th>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                    <th className="px-4 py-2 font-medium">Entrada</th>
                    <th className="px-4 py-2 font-medium">Salida</th>
                    <th className="px-4 py-2" />
                  </tr></thead>
                  <tbody>
                    {pastoreos.map((p) => (
                      <tr key={p.id} className="border-t border-stone-100">
                        <td className="px-4 py-2"><div className="font-medium text-stone-900">{p.campos?.nombre}</div><div className="text-xs text-stone-500">{p.lotes?.nombre}</div></td>
                        <td className="px-4 py-2 text-stone-700">{p.categorias_hacienda?.nombre}</td>
                        <td className="px-4 py-2 text-right font-medium">{p.cantidad.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-stone-600">{new Date(p.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-2 text-stone-600">
                          {p.fecha_salida ? new Date(p.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR') : <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">En lote</span>}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2 justify-end flex-wrap">
                            {pastoreoTab === 'actual' && !p.fecha_salida && (
                              <button onClick={() => registrarSalida(p.id)} className="text-xs text-stone-500 hover:text-stone-900 underline">Salida hoy</button>
                            )}
                            <button onClick={() => abrirEditPast(p)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                            <button onClick={() => handleBorrarPast(p.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ SANIDAD ================================================================ */}
      {tab === 'sanidad' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <form onSubmit={handleSubmitSanidad} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Registrar aplicación sanitaria</h2>
            {sError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{sError}</div>}
            {sExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{sExito}</div>}

            <div><label className={labelCls}>Campo</label>
              <select value={sCampoId} onChange={(e) => { setSCampoId(e.target.value); setSLoteId('') }} className={inputCls}>
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Lote <span className="text-stone-400">(opcional)</span></label>
              <select value={sLoteId} onChange={(e) => setSLoteId(e.target.value)} disabled={!sCampoId} className={`${inputCls} disabled:opacity-50`}>
                <option value="">Todo el campo</option>
                {lotesPorCampo(sCampoId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Categoría <span className="text-stone-400">(opcional)</span></label>
              <select value={sCategoriaId} onChange={(e) => setSCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Todas las categorías</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">Producto</label>
                <button type="button" onClick={() => setShowNuevoProducto((v) => !v)} className="text-xs text-stone-500 underline hover:text-stone-700">
                  {showNuevoProducto ? 'Cancelar' : '+ Nuevo producto'}
                </button>
              </div>
              {showNuevoProducto ? (
                <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <input placeholder="Nombre del producto" value={npNombre} onChange={(e) => setNpNombre(e.target.value)} className={inputCls} />
                  <select value={npTipo} onChange={(e) => setNpTipo(e.target.value)} className={inputCls}>
                    {TIPOS_PRODUCTO.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <select value={npUnidad} onChange={(e) => setNpUnidad(e.target.value)} className={inputCls}>
                    {UNIDADES_PRODUCTO.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button type="button" onClick={handleGuardarProducto} disabled={npGuardando || !npNombre.trim()} className="w-full rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                    {npGuardando ? 'Guardando...' : 'Guardar producto'}
                  </button>
                </div>
              ) : (
                <select value={sProductoId} onChange={(e) => setSProductoId(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar producto...</option>
                  {productosVet.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
                </select>
              )}
            </div>

            <div><label className={labelCls}>Fecha</label>
              <input type="date" value={sFecha} onChange={(e) => setSFecha(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Cantidad de animales</label>
              <input type="number" min={1} value={sCantidadAnimales} onChange={(e) => setSCantidadAnimales(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Dosis por animal {productoSeleccionado ? `(${productoSeleccionado.unidad})` : ''}</label>
              <input type="number" min={0} step="0.001" value={sDosisPorAnimal} onChange={(e) => setSDosisPorAnimal(e.target.value)} className={inputCls} />
              {sCantidadAnimales && sDosisPorAnimal && totalProducto > 0 && (
                <p className="mt-1 text-xs text-stone-500">Total: {totalProducto.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {productoSeleccionado?.unidad}</p>
              )}
            </div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={sObservaciones} onChange={(e) => setSObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={sGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {sGuardando ? 'Guardando...' : 'Registrar aplicación'}
            </button>
          </form>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-900">Historial de sanidad</h2>
            {cargandoSanidad && <p className="text-sm text-stone-500">Cargando...</p>}
            {!cargandoSanidad && sanidades.length === 0 && <p className="text-sm text-stone-500">Sin aplicaciones registradas.</p>}
            {!cargandoSanidad && sanidades.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Fecha</th>
                    <th className="px-4 py-2 font-medium">Campo / Lote</th>
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 font-medium">Producto</th>
                    <th className="px-4 py-2 text-right font-medium">Animales</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr></thead>
                  <tbody>
                    {sanidades.map((s) => (
                      <tr key={s.id} className="border-t border-stone-100">
                        <td className="px-4 py-2 text-stone-600">{new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-2"><div className="font-medium text-stone-900">{s.campos?.nombre}</div><div className="text-xs text-stone-500">{s.lotes?.nombre ?? 'Todo el campo'}</div></td>
                        <td className="px-4 py-2 text-stone-700">{s.categorias_hacienda?.nombre ?? 'Todas'}</td>
                        <td className="px-4 py-2 text-stone-700">{s.productos_veterinarios?.nombre}</td>
                        <td className="px-4 py-2 text-right text-stone-900">{s.cantidad_animales.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-right text-stone-900">{Number(s.total_producto).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {s.productos_veterinarios?.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ MODAL EDITAR MOVIMIENTO ================================================================ */}
      {editMov && (
        <Modal title="Editar movimiento" onClose={() => setEditMov(null)}>
          {emError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{emError}</div>}
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <span className="font-medium">{editMov.campos?.nombre}</span> · {LABEL_TIPO[editMov.tipo_movimiento] ?? editMov.tipo_movimiento}
          </div>

          <div><label className={labelCls}>Categoría</label>
            <select value={emCategoriaId} onChange={(e) => setEmCategoriaId(e.target.value)} className={inputCls}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={emCantidad} onChange={(e) => setEmCantidad(e.target.value)} className={inputCls} /></div>

          {REQUIERE_PRECIO.includes(editMov.tipo_movimiento) && (
            <div><label className={labelCls}>Precio por cabeza (USD)</label>
              <input type="number" min={0} step="0.01" value={emPrecio} onChange={(e) => setEmPrecio(e.target.value)} className={inputCls} /></div>
          )}

          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={emFecha} onChange={(e) => setEmFecha(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={emObs} onChange={(e) => setEmObs(e.target.value)} rows={2} className={inputCls} /></div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditMov(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditMov} disabled={emGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {emGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {/* ================================================================ MODAL EDITAR PASTOREO ================================================================ */}
      {editPast && (
        <Modal title="Editar pastoreo" onClose={() => setEditPast(null)}>
          {epError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{epError}</div>}
          <div className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <span className="font-medium">{editPast.campos?.nombre}</span>
          </div>

          <div><label className={labelCls}>Lote</label>
            <select value={epLoteId} onChange={(e) => setEpLoteId(e.target.value)} className={inputCls}>
              {lotesPorCampo(String(editPast.campo_id)).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Categoría</label>
            <select value={epCategoriaId} onChange={(e) => setEpCategoriaId(e.target.value)} className={inputCls}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>

          <div><label className={labelCls}>Cantidad de cabezas</label>
            <input type="number" min={1} value={epCantidad} onChange={(e) => setEpCantidad(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Fecha de entrada</label>
            <input type="date" value={epFechaEntrada} onChange={(e) => setEpFechaEntrada(e.target.value)} className={inputCls} /></div>

          <div><label className={labelCls}>Fecha de salida <span className="text-stone-400">(opcional)</span></label>
            <input type="date" value={epFechaSalida} onChange={(e) => setEpFechaSalida(e.target.value)} min={epFechaEntrada} className={inputCls} /></div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={epObs} onChange={(e) => setEpObs(e.target.value)} rows={2} className={inputCls} /></div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditPast(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditPast} disabled={epGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {epGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
