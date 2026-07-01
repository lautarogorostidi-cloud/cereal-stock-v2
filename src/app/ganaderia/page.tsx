'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// =====================================================================
// Tipos
// =====================================================================

type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; campo_id: number }
type CategoriaHacienda = { id: string; nombre: string; orden: number }

type StockRow = {
  campo_id: number
  campo_nombre: string
  categoria_id: string
  categoria_nombre: string
  categoria_orden: number
  stock_actual: number
}

type StockPorCampo = {
  campo_nombre: string
  filas: StockRow[]
  total: number
}

type Pastoreo = {
  id: string
  campo_id: number
  lote_id: string
  categoria_id: string
  cantidad: number
  fecha_entrada: string
  fecha_salida: string | null
  observaciones: string | null
  lotes: { nombre: string }
  categorias_hacienda: { nombre: string }
  campos: { nombre: string }
}

type TipoMovimientoUI =
  | 'compra'
  | 'venta'
  | 'nacimiento'
  | 'muerte'
  | 'recategorizacion'
  | 'ajuste_positivo'
  | 'ajuste_negativo'

const TIPOS_MOVIMIENTO: { value: TipoMovimientoUI; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'venta', label: 'Venta' },
  { value: 'nacimiento', label: 'Nacimiento' },
  { value: 'muerte', label: 'Muerte / Desaparecido' },
  { value: 'recategorizacion', label: 'Recategorización' },
  { value: 'ajuste_positivo', label: 'Ajuste (suma)' },
  { value: 'ajuste_negativo', label: 'Ajuste (resta)' },
]

const REQUIERE_PRECIO: TipoMovimientoUI[] = ['compra', 'venta']

type Tab = 'movimientos' | 'pastoreo'
type PastoreoTab = 'actual' | 'historial'

// =====================================================================
// Página
// =====================================================================

export default function GanaderiaPage() {
  const supabase = createClient()

  // ---- Catálogos ----
  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])

  // ---- Tab principal ----
  const [tab, setTab] = useState<Tab>('movimientos')

  // ---- Formulario movimientos ----
  const [campoId, setCampoId] = useState<string>('')
  const [tipo, setTipo] = useState<TipoMovimientoUI>('compra')
  const [categoriaId, setCategoriaId] = useState<string>('')
  const [categoriaDestinoId, setCategoriaDestinoId] = useState<string>('')
  const [cantidad, setCantidad] = useState<string>('')
  const [precioCabeza, setPrecioCabeza] = useState<string>('')
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // ---- Formulario pastoreo ----
  const [pCampoId, setPCampoId] = useState<string>('')
  const [pLoteId, setPLoteId] = useState<string>('')
  const [pCategoriaId, setPCategoriaId] = useState<string>('')
  const [pCantidad, setPCantidad] = useState<string>('')
  const [pFechaEntrada, setPFechaEntrada] = useState<string>(new Date().toISOString().slice(0, 10))
  const [pFechaSalida, setPFechaSalida] = useState<string>('')
  const [pObservaciones, setPObservaciones] = useState<string>('')
  const [pGuardando, setPGuardando] = useState(false)
  const [pError, setPError] = useState<string | null>(null)
  const [pExito, setPExito] = useState<string | null>(null)

  // ---- Stock ----
  const [stock, setStock] = useState<StockPorCampo[]>([])
  const [cargandoStock, setCargandoStock] = useState(true)
  const [errorStock, setErrorStock] = useState<string | null>(null)

  // ---- Pastoreos ----
  const [pastoreoTab, setPastoreoTab] = useState<PastoreoTab>('actual')
  const [pastoreos, setPastoreos] = useState<Pastoreo[]>([])
  const [cargandoPastoreos, setCargandoPastoreos] = useState(false)

  // ---- Carga inicial ----
  useEffect(() => {
    const cargarCatalogos = async () => {
      const [{ data: camposData }, { data: lotesData }, { data: categoriasData }] =
        await Promise.all([
          supabase.from('campos').select('id, nombre').order('nombre'),
          supabase.from('lotes').select('id, nombre, campo_id').eq('activo', true).order('nombre'),
          supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
        ])
      setCampos(camposData ?? [])
      setLotes(lotesData ?? [])
      setCategorias(categoriasData ?? [])
    }
    cargarCatalogos()
  }, [supabase])

  const cargarStock = async () => {
    setCargandoStock(true)
    setErrorStock(null)
    const { data, error: errorQuery } = await supabase
      .from('vw_stock_hacienda')
      .select('*')
      .order('campo_nombre')
      .order('categoria_orden')

    if (errorQuery) { setErrorStock(errorQuery.message); setCargandoStock(false); return }

    const filas = (data ?? []) as StockRow[]
    const agrupado = new Map<string, StockPorCampo>()
    for (const fila of filas) {
      if (fila.stock_actual === 0) continue
      if (!agrupado.has(fila.campo_nombre)) {
        agrupado.set(fila.campo_nombre, { campo_nombre: fila.campo_nombre, filas: [], total: 0 })
      }
      const grupo = agrupado.get(fila.campo_nombre)!
      grupo.filas.push(fila)
      grupo.total += fila.stock_actual
    }
    setStock(Array.from(agrupado.values()))
    setCargandoStock(false)
  }

  const cargarPastoreos = async (soloActivos: boolean) => {
    setCargandoPastoreos(true)
    let query = supabase
      .from('pastoreos')
      .select('*, lotes(nombre), categorias_hacienda(nombre), campos(nombre)')
      .order('fecha_entrada', { ascending: false })

    if (soloActivos) query = query.is('fecha_salida', null)

    const { data } = await query
    setPastoreos((data ?? []) as Pastoreo[])
    setCargandoPastoreos(false)
  }

  useEffect(() => { cargarStock() }, [])
  useEffect(() => { cargarPastoreos(pastoreoTab === 'actual') }, [pastoreoTab])

  // ---- Lotes filtrados por campo ----
  const lotesFiltrados = lotes.filter((l) => !pCampoId || l.campo_id === Number(pCampoId))

  // ---- Helpers movimientos ----
  const esRecategorizacion = tipo === 'recategorizacion'
  const requierePrecio = REQUIERE_PRECIO.includes(tipo)

  const resetFormMov = () => {
    setCategoriaId(''); setCategoriaDestinoId(''); setCantidad('')
    setPrecioCabeza(''); setObservaciones('')
  }

  const validarMov = (): string | null => {
    if (!campoId) return 'Seleccioná un campo.'
    if (!categoriaId) return 'Seleccioná una categoría.'
    if (esRecategorizacion && !categoriaDestinoId) return 'Seleccioná la categoría destino.'
    if (esRecategorizacion && categoriaDestinoId === categoriaId) return 'Las categorías deben ser distintas.'
    if (!cantidad || Number(cantidad) <= 0) return 'Ingresá una cantidad mayor a 0.'
    if (requierePrecio && (!precioCabeza || Number(precioCabeza) <= 0)) return 'Ingresá un precio por cabeza válido.'
    if (!fecha) return 'Seleccioná una fecha.'
    return null
  }

  const handleSubmitMov = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setExito(null)
    const err = validarMov()
    if (err) { setError(err); return }
    setGuardando(true)
    try {
      const cantidadNum = Number(cantidad)
      const precioNum = requierePrecio ? Number(precioCabeza) : null

      if (esRecategorizacion) {
        const { data: baja, error: eBaja } = await supabase
          .from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantidadNum, tipo_movimiento: 'recategorizacion_baja', fecha, observaciones: observaciones || null })
          .select('id').single()
        if (eBaja || !baja) throw eBaja ?? new Error('Error al registrar la baja.')

        const { data: alta, error: eAlta } = await supabase
          .from('movimientos_hacienda')
          .insert({ campo_id: Number(campoId), categoria_id: categoriaDestinoId, cantidad: cantidadNum, tipo_movimiento: 'recategorizacion_alta', fecha, observaciones: observaciones || null, movimiento_relacionado_id: baja.id })
          .select('id').single()
        if (eAlta || !alta) {
          await supabase.from('movimientos_hacienda').delete().eq('id', baja.id)
          throw eAlta ?? new Error('Error al registrar la alta.')
        }
        await supabase.from('movimientos_hacienda').update({ movimiento_relacionado_id: alta.id }).eq('id', baja.id)
      } else {
        const { error: eIns } = await supabase.from('movimientos_hacienda').insert({
          campo_id: Number(campoId), categoria_id: categoriaId, cantidad: cantidadNum,
          tipo_movimiento: tipo, fecha, precio_cabeza_usd: precioNum, observaciones: observaciones || null,
        })
        if (eIns) throw eIns
      }
      setExito('Movimiento registrado correctamente.')
      resetFormMov()
      cargarStock()
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar el movimiento.')
    } finally {
      setGuardando(false)
    }
  }

  // ---- Helpers pastoreo ----
  const validarPastoreo = (): string | null => {
    if (!pCampoId) return 'Seleccioná un campo.'
    if (!pLoteId) return 'Seleccioná un lote.'
    if (!pCategoriaId) return 'Seleccioná una categoría.'
    if (!pCantidad || Number(pCantidad) <= 0) return 'Ingresá una cantidad mayor a 0.'
    if (!pFechaEntrada) return 'Ingresá la fecha de entrada.'
    if (pFechaSalida && pFechaSalida < pFechaEntrada) return 'La fecha de salida debe ser posterior a la de entrada.'
    return null
  }

  const handleSubmitPastoreo = async (e: React.FormEvent) => {
    e.preventDefault()
    setPError(null); setPExito(null)
    const err = validarPastoreo()
    if (err) { setPError(err); return }
    setPGuardando(true)
    try {
      const { error: eIns } = await supabase.from('pastoreos').insert({
        campo_id: Number(pCampoId),
        lote_id: pLoteId,
        categoria_id: pCategoriaId,
        cantidad: Number(pCantidad),
        fecha_entrada: pFechaEntrada,
        fecha_salida: pFechaSalida || null,
        observaciones: pObservaciones || null,
      })
      if (eIns) throw eIns
      setPExito('Pastoreo registrado correctamente.')
      setPLoteId(''); setPCategoriaId(''); setPCantidad('')
      setPFechaSalida(''); setPObservaciones('')
      cargarPastoreos(pastoreoTab === 'actual')
    } catch (err: any) {
      setPError(err?.message ?? 'Error al guardar el pastoreo.')
    } finally {
      setPGuardando(false)
    }
  }

  const registrarSalida = async (id: string) => {
    const hoy = new Date().toISOString().slice(0, 10)
    await supabase.from('pastoreos').update({ fecha_salida: hoy }).eq('id', id)
    cargarPastoreos(pastoreoTab === 'actual')
  }

  // =====================================================================
  // Render
  // =====================================================================

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Ganadería</h1>
        <p className="text-sm text-stone-500">Stock de hacienda, movimientos y pastoreo por lote.</p>
      </div>

      {/* Tabs principales */}
      <div className="flex gap-1 border-b border-stone-200">
        {(['movimientos', 'pastoreo'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-stone-900 text-stone-900'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t === 'movimientos' ? 'Movimientos de hacienda' : 'Pastoreo por lote'}
          </button>
        ))}
      </div>

      {/* ============================================================
          TAB: MOVIMIENTOS
      ============================================================ */}
      {tab === 'movimientos' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[400px_1fr]">
          {/* Formulario movimientos */}
          <form onSubmit={handleSubmitMov} className="space-y-5 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Nuevo movimiento</h2>

            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Campo</label>
              <select value={campoId} onChange={(e) => setCampoId(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Tipo de movimiento</label>
              <select value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMovimientoUI); setCategoriaDestinoId(''); setPrecioCabeza('') }} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                {TIPOS_MOVIMIENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">{esRecategorizacion ? 'Categoría origen' : 'Categoría'}</label>
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {esRecategorizacion && (
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Categoría destino</label>
                <select value={categoriaDestinoId} onChange={(e) => setCategoriaDestinoId(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                  <option value="">Seleccionar categoría...</option>
                  {categorias.filter((c) => c.id !== categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Cantidad de cabezas</label>
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            {requierePrecio && (
              <div>
                <label className="mb-1 block text-sm font-medium text-stone-700">Precio por cabeza (USD)</label>
                <input type="number" min={0} step="0.01" value={precioCabeza} onChange={(e) => setPrecioCabeza(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
                {cantidad && precioCabeza && (
                  <p className="mt-1 text-xs text-stone-500">Total: USD {(Number(cantidad) * Number(precioCabeza)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Observaciones</label>
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Guardar movimiento'}
            </button>
          </form>

          {/* Stock actual */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-stone-900">Stock actual</h2>
            {cargandoStock && <p className="text-sm text-stone-500">Cargando stock...</p>}
            {!cargandoStock && errorStock && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">Error al cargar el stock: {errorStock}</div>}
            {!cargandoStock && !errorStock && stock.length === 0 && <p className="text-sm text-stone-500">No hay cabezas registradas todavía.</p>}
            {!cargandoStock && !errorStock && stock.length > 0 && (
              <div className="space-y-6">
                {stock.map((grupo) => (
                  <div key={grupo.campo_nombre} className="overflow-hidden rounded-lg border border-stone-200">
                    <div className="flex items-center justify-between bg-stone-50 px-4 py-2">
                      <h3 className="text-sm font-semibold text-stone-900">{grupo.campo_nombre}</h3>
                      <span className="text-sm text-stone-500">{grupo.total.toLocaleString('es-AR')} cabezas</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-left text-stone-500">
                          <th className="px-4 py-2 font-medium">Categoría</th>
                          <th className="px-4 py-2 text-right font-medium">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.filas.map((fila) => (
                          <tr key={fila.categoria_id} className="border-b border-stone-100 last:border-0">
                            <td className="px-4 py-2 text-stone-700">{fila.categoria_nombre}</td>
                            <td className="px-4 py-2 text-right font-medium text-stone-900">{fila.stock_actual.toLocaleString('es-AR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          TAB: PASTOREO
      ============================================================ */}
      {tab === 'pastoreo' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[400px_1fr]">
          {/* Formulario pastoreo */}
          <form onSubmit={handleSubmitPastoreo} className="space-y-5 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-stone-900">Registrar pastoreo</h2>

            {pError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pError}</div>}
            {pExito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{pExito}</div>}

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Campo</label>
              <select value={pCampoId} onChange={(e) => { setPCampoId(e.target.value); setPLoteId('') }} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Lote</label>
              <select value={pLoteId} onChange={(e) => setPLoteId(e.target.value)} disabled={!pCampoId} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none disabled:opacity-50">
                <option value="">Seleccionar lote...</option>
                {lotesFiltrados.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Categoría</label>
              <select value={pCategoriaId} onChange={(e) => setPCategoriaId(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none">
                <option value="">Seleccionar categoría...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Cantidad de cabezas</label>
              <input type="number" min={1} value={pCantidad} onChange={(e) => setPCantidad(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Fecha de entrada</label>
              <input type="date" value={pFechaEntrada} onChange={(e) => setPFechaEntrada(e.target.value)} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Fecha de salida <span className="text-stone-400">(opcional)</span></label>
              <input type="date" value={pFechaSalida} onChange={(e) => setPFechaSalida(e.target.value)} min={pFechaEntrada} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">Observaciones</label>
              <textarea value={pObservaciones} onChange={(e) => setPObservaciones(e.target.value)} rows={2} className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none" />
            </div>

            <button type="submit" disabled={pGuardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {pGuardando ? 'Guardando...' : 'Registrar pastoreo'}
            </button>
          </form>

          {/* Tabla pastoreos */}
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

            {!cargandoPastoreos && pastoreos.length === 0 && (
              <p className="text-sm text-stone-500">No hay registros de pastoreo.</p>
            )}

            {!cargandoPastoreos && pastoreos.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-2 font-medium">Campo / Lote</th>
                      <th className="px-4 py-2 font-medium">Categoría</th>
                      <th className="px-4 py-2 text-right font-medium">Cabezas</th>
                      <th className="px-4 py-2 font-medium">Entrada</th>
                      <th className="px-4 py-2 font-medium">Salida</th>
                      {pastoreoTab === 'actual' && <th className="px-4 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {pastoreos.map((p) => (
                      <tr key={p.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2">
                          <div className="font-medium text-stone-900">{p.campos?.nombre}</div>
                          <div className="text-xs text-stone-500">{p.lotes?.nombre}</div>
                        </td>
                        <td className="px-4 py-2 text-stone-700">{p.categorias_hacienda?.nombre}</td>
                        <td className="px-4 py-2 text-right font-medium text-stone-900">{p.cantidad.toLocaleString('es-AR')}</td>
                        <td className="px-4 py-2 text-stone-600">{new Date(p.fecha_entrada + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-2 text-stone-600">
                          {p.fecha_salida
                            ? new Date(p.fecha_salida + 'T00:00:00').toLocaleDateString('es-AR')
                            : <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">En lote</span>}
                        </td>
                        {pastoreoTab === 'actual' && (
                          <td className="px-4 py-2">
                            <button onClick={() => registrarSalida(p.id)} className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 transition">
                              Registrar salida
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
