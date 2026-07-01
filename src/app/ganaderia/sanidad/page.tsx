'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type Campania = { id: number; nombre: string }
type ProductoVeterinario = { id: string; nombre: string; tipo: string; unidad: string; precio_usd: number | null }
type SanidadRow = {
  id: string; campo_id: number; lote_id: string | null; categoria_id: string | null
  campania_id: number | null; fecha: string; cantidad_animales: number
  dosis_por_animal: number; total_producto: number
  precio_unitario_usd: number | null; costo_total_usd: number | null
  observaciones: string | null
  productos_veterinarios: { nombre: string; unidad: string }
  lotes: { nombre: string } | null
  categorias_hacienda: { nombre: string } | null
  campos: { nombre: string }
  campanas: { nombre: string } | null
}

const TIPOS_PRODUCTO = ['vacuna', 'antiparasitario', 'antibiotico', 'vitamina', 'otro']
const UNIDADES_PRODUCTO = ['ml', 'cc', 'comprimido', 'dosis', 'g', 'otro']
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
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  )
}

export default function SanidadPage() {
  const supabase = createClient()

  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [productosVet, setProductosVet] = useState<ProductoVeterinario[]>([])

  const [sCampoId, setSCampoId] = useState('')
  const [sLoteId, setSLoteId] = useState('')
  const [sCategoriaId, setSCategoriaId] = useState('')
  const [sCampaniaId, setSCampaniaId] = useState('')
  const [sProductoId, setSProductoId] = useState('')
  const [sFecha, setSFecha] = useState(new Date().toISOString().slice(0, 10))
  const [sCantidadAnimales, setSCantidadAnimales] = useState('')
  const [sDosisPorAnimal, setSDosisPorAnimal] = useState('')
  const [sPrecioUnitario, setSPrecioUnitario] = useState('')
  const [sObservaciones, setSObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [npNombre, setNpNombre] = useState('')
  const [npTipo, setNpTipo] = useState('vacuna')
  const [npUnidad, setNpUnidad] = useState('ml')
  const [npPrecio, setNpPrecio] = useState('')
  const [npGuardando, setNpGuardando] = useState(false)

  const [sanidades, setSanidades] = useState<SanidadRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroCampania, setFiltroCampania] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')

  const [editSan, setEditSan] = useState<SanidadRow | null>(null)
  const [esCampoId, setEsCampoId] = useState('')
  const [esLoteId, setEsLoteId] = useState('')
  const [esCategoriaId, setEsCategoriaId] = useState('')
  const [esCampaniaId, setEsCampaniaId] = useState('')
  const [esProductoId, setEsProductoId] = useState('')
  const [esFecha, setEsFecha] = useState('')
  const [esCantidadAnimales, setEsCantidadAnimales] = useState('')
  const [esDosisPorAnimal, setEsDosisPorAnimal] = useState('')
  const [esPrecioUnitario, setEsPrecioUnitario] = useState('')
  const [esObs, setEsObs] = useState('')
  const [esGuardando, setEsGuardando] = useState(false)
  const [esError, setEsError] = useState<string | null>(null)

  const [editProd, setEditProd] = useState<ProductoVeterinario | null>(null)
  const [epNombre, setEpNombre] = useState('')
  const [epTipo, setEpTipo] = useState('')
  const [epUnidad, setEpUnidad] = useState('')
  const [epPrecio, setEpPrecio] = useState('')
  const [epGuardando, setEpGuardando] = useState(false)
  const [epError, setEpError] = useState<string | null>(null)
  const [showProductos, setShowProductos] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: l }, { data: cat }, { data: camp }, { data: prod }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('lotes').select('id, nombre, establecimiento').eq('activo', true).order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
        supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false }),
        supabase.from('productos_veterinarios').select('id, nombre, tipo, unidad, precio_usd').eq('activo', true).order('nombre'),
      ])
      setCampos(c ?? []); setLotes(l ?? []); setCategorias(cat ?? [])
      setCampanias(camp ?? []); setProductosVet(prod ?? [])
    }
    cargar(); cargarSanidad()
  }, [])

  const cargarSanidad = async () => {
    setCargando(true)
    const { data } = await supabase
      .from('sanidad_hacienda')
      .select('*, productos_veterinarios(nombre, unidad), lotes(nombre), categorias_hacienda(nombre), campos(nombre), campanas(nombre)')
      .order('fecha', { ascending: false })
    setSanidades((data ?? []) as SanidadRow[]); setCargando(false)
  }

  const nombreCampo = (id: string) => campos.find((c) => c.id === Number(id))?.nombre ?? ''
  const lotesPorCampo = (campoIdStr: string) =>
    campoIdStr ? lotes.filter((l) => l.establecimiento === nombreCampo(campoIdStr)) : lotes

  const handleSelectProducto = (id: string) => {
    setSProductoId(id)
    const prod = productosVet.find((p) => p.id === id)
    setSPrecioUnitario(prod?.precio_usd ? String(prod.precio_usd) : '')
  }

  const handleSelectProductoEdit = (id: string) => {
    setEsProductoId(id)
    const prod = productosVet.find((p) => p.id === id)
    if (prod?.precio_usd) setEsPrecioUnitario(String(prod.precio_usd))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!sCampoId) return setError('Selecciona un campo.')
    if (!sProductoId) return setError('Selecciona un producto.')
    if (!sCantidadAnimales || Number(sCantidadAnimales) <= 0) return setError('Ingresa la cantidad de animales.')
    if (!sDosisPorAnimal || Number(sDosisPorAnimal) <= 0) return setError('Ingresa la dosis por animal.')
    setGuardando(true)
    try {
      const { error: eIns } = await supabase.from('sanidad_hacienda').insert({
        campo_id: Number(sCampoId), lote_id: sLoteId || null, categoria_id: sCategoriaId || null,
        campania_id: sCampaniaId ? Number(sCampaniaId) : null,
        producto_id: sProductoId, fecha: sFecha,
        cantidad_animales: Number(sCantidadAnimales), dosis_por_animal: Number(sDosisPorAnimal),
        precio_unitario_usd: sPrecioUnitario ? Number(sPrecioUnitario) : null,
        observaciones: sObservaciones || null,
      })
      if (eIns) throw eIns
      setExito('Aplicacion registrada.')
      setSLoteId(''); setSCategoriaId(''); setSProductoId(''); setSCantidadAnimales('')
      setSDosisPorAnimal(''); setSPrecioUnitario(''); setSObservaciones('')
      cargarSanidad()
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
  }

  const handleGuardarProducto = async () => {
    if (!npNombre.trim()) return
    setNpGuardando(true)
    const { data, error: eIns } = await supabase.from('productos_veterinarios')
      .insert({ nombre: npNombre.trim(), tipo: npTipo, unidad: npUnidad, precio_usd: npPrecio ? Number(npPrecio) : null })
      .select('id, nombre, tipo, unidad, precio_usd').single()
    if (!eIns && data) {
      setProductosVet((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSProductoId(data.id)
      if (data.precio_usd) setSPrecioUnitario(String(data.precio_usd))
      setNpNombre(''); setNpTipo('vacuna'); setNpUnidad('ml'); setNpPrecio(''); setShowNuevoProducto(false)
    }
    setNpGuardando(false)
  }

  const abrirEditSan = (s: SanidadRow) => {
    setEditSan(s); setEsCampoId(String(s.campo_id)); setEsLoteId(s.lote_id ?? '')
    setEsCategoriaId(s.categoria_id ?? ''); setEsCampaniaId(s.campania_id ? String(s.campania_id) : '')
    setEsProductoId(''); setEsFecha(s.fecha); setEsCantidadAnimales(String(s.cantidad_animales))
    setEsDosisPorAnimal(String(s.dosis_por_animal))
    setEsPrecioUnitario(s.precio_unitario_usd ? String(s.precio_unitario_usd) : '')
    setEsObs(s.observaciones ?? ''); setEsError(null)
  }

  const handleGuardarEditSan = async () => {
    if (!editSan) return; setEsError(null)
    if (!esCantidadAnimales || Number(esCantidadAnimales) <= 0) return setEsError('Ingresa una cantidad valida.')
    if (!esDosisPorAnimal || Number(esDosisPorAnimal) <= 0) return setEsError('Ingresa una dosis valida.')
    setEsGuardando(true)
    try {
      const updateData: Record<string, any> = {
        campo_id: Number(esCampoId), lote_id: esLoteId || null, categoria_id: esCategoriaId || null,
        campania_id: esCampaniaId ? Number(esCampaniaId) : null,
        fecha: esFecha, cantidad_animales: Number(esCantidadAnimales),
        dosis_por_animal: Number(esDosisPorAnimal),
        precio_unitario_usd: esPrecioUnitario ? Number(esPrecioUnitario) : null,
        observaciones: esObs || null,
      }
      if (esProductoId) updateData.producto_id = esProductoId
      const { error: eUp } = await supabase.from('sanidad_hacienda').update(updateData).eq('id', editSan.id)
      if (eUp) throw eUp
      setEditSan(null); cargarSanidad()
    } catch (err: any) { setEsError(err?.message ?? 'Error al guardar.') }
    finally { setEsGuardando(false) }
  }

  const handleBorrarSan = async (id: string) => {
    if (!confirm('Borrar este registro de sanidad?')) return
    await supabase.from('sanidad_hacienda').delete().eq('id', id)
    cargarSanidad()
  }

  const abrirEditProd = (p: ProductoVeterinario) => {
    setEditProd(p); setEpNombre(p.nombre); setEpTipo(p.tipo); setEpUnidad(p.unidad)
    setEpPrecio(p.precio_usd ? String(p.precio_usd) : ''); setEpError(null)
  }

  const handleGuardarEditProd = async () => {
    if (!editProd || !epNombre.trim()) return; setEpError(null)
    setEpGuardando(true)
    try {
      const { error: eUp } = await supabase.from('productos_veterinarios').update({
        nombre: epNombre.trim(), tipo: epTipo, unidad: epUnidad,
        precio_usd: epPrecio ? Number(epPrecio) : null,
      }).eq('id', editProd.id)
      if (eUp) throw eUp
      setProductosVet((prev) => prev.map((p) => p.id === editProd.id ? { ...p, nombre: epNombre, tipo: epTipo, unidad: epUnidad, precio_usd: epPrecio ? Number(epPrecio) : null } : p))
      setEditProd(null)
    } catch (err: any) { setEpError(err?.message ?? 'Error al guardar.') }
    finally { setEpGuardando(false) }
  }

  const handleBorrarProd = async (id: string) => {
    if (!confirm('Borrar este producto del catalogo?')) return
    await supabase.from('productos_veterinarios').update({ activo: false }).eq('id', id)
    setProductosVet((prev) => prev.filter((p) => p.id !== id))
  }

  const productoSeleccionado = productosVet.find((p) => p.id === sProductoId)
  const totalProducto = Number(sCantidadAnimales) * Number(sDosisPorAnimal)
  const costoTotal = totalProducto * Number(sPrecioUnitario)
  const sanidadesFiltradas = sanidades.filter((s) => {
    if (filtroCampania && s.campania_id !== Number(filtroCampania)) return false
    if (filtroCampo && s.campo_id !== Number(filtroCampo)) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Sanidad</h1>
        <p className="text-sm text-stone-500">Registra aplicaciones sanitarias: vacunas, antiparasitarios y tratamientos.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
            <h2 className="text-base font-semibold text-stone-900">Nueva aplicacion</h2>
            {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

            <div><label className={labelCls}>Campana</label>
              <select value={sCampaniaId} onChange={(e) => setSCampaniaId(e.target.value)} className={inputCls}>
                <option value="">Seleccionar campana...</option>
                {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Campo</label>
              <select value={sCampoId} onChange={(e) => { setSCampoId(e.target.value); setSLoteId('') }} className={inputCls}>
                <option value="">Seleccionar campo...</option>
                {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Lote <span className="text-stone-400">(opcional)</span></label>
              <select value={sLoteId} onChange={(e) => setSLoteId(e.target.value)} disabled={!sCampoId} className={inputCls + ' disabled:opacity-50'}>
                <option value="">Todo el campo</option>
                {lotesPorCampo(sCampoId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </select></div>

            <div><label className={labelCls}>Categoria <span className="text-stone-400">(opcional)</span></label>
              <select value={sCategoriaId} onChange={(e) => setSCategoriaId(e.target.value)} className={inputCls}>
                <option value="">Todas las categorias</option>
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
                  <div>
                    <label className="mb-1 block text-xs text-stone-600">Precio (USD / {npUnidad || 'unidad'})</label>
                    <input type="number" min={0} step="0.01" placeholder="0.00" value={npPrecio} onChange={(e) => setNpPrecio(e.target.value)} className={inputCls} />
                  </div>
                  <button type="button" onClick={handleGuardarProducto} disabled={npGuardando || !npNombre.trim()} className="w-full rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                    {npGuardando ? 'Guardando...' : 'Guardar producto'}
                  </button>
                </div>
              ) : (
                <select value={sProductoId} onChange={(e) => handleSelectProducto(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar producto...</option>
                  {productosVet.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
                </select>
              )}
            </div>

            <div><label className={labelCls}>Fecha</label>
              <input type="date" value={sFecha} onChange={(e) => setSFecha(e.target.value)} className={inputCls} /></div>

            <div><label className={labelCls}>Cantidad de animales</label>
              <input type="number" min={1} value={sCantidadAnimales} onChange={(e) => setSCantidadAnimales(e.target.value)} className={inputCls} /></div>

            <div>
              <label className={labelCls}>Dosis por animal {productoSeleccionado ? '(' + productoSeleccionado.unidad + ')' : ''}</label>
              <input type="number" min={0} step="0.001" value={sDosisPorAnimal} onChange={(e) => setSDosisPorAnimal(e.target.value)} className={inputCls} />
              {sCantidadAnimales && sDosisPorAnimal && totalProducto > 0 && (
                <p className="mt-1 text-xs text-stone-500">Total producto: {totalProducto.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {productoSeleccionado?.unidad}</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Precio por {productoSeleccionado?.unidad ?? 'unidad'} (USD)</label>
              <input type="number" min={0} step="0.01" placeholder="0.00" value={sPrecioUnitario} onChange={(e) => setSPrecioUnitario(e.target.value)} className={inputCls} />
              {sPrecioUnitario && totalProducto > 0 && (
                <p className="mt-1 text-xs text-stone-500">Costo total: USD {costoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              )}
            </div>

            <div><label className={labelCls}>Observaciones</label>
              <textarea value={sObservaciones} onChange={(e) => setSObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

            <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
              {guardando ? 'Guardando...' : 'Registrar aplicacion'}
            </button>
          </form>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <button onClick={() => setShowProductos((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-stone-900">
              <span>Catalogo de productos</span>
              <span className="text-stone-400">{showProductos ? 'A' : 'V'}</span>
            </button>
            {showProductos && (
              <div className="mt-3 space-y-2">
                {productosVet.length === 0 && <p className="text-xs text-stone-500">Sin productos cargados.</p>}
                {productosVet.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-stone-900">{p.nombre}</span>
                      <span className="ml-2 text-xs text-stone-500">{p.tipo} - {p.unidad}</span>
                      {p.precio_usd && <span className="ml-2 text-xs text-stone-500">USD {Number(p.precio_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 })}/{p.unidad}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditProd(p)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                      <button onClick={() => handleBorrarProd(p.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-stone-900">Historial</h2>
            <select value={filtroCampania} onChange={(e) => setFiltroCampania(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
              <option value="">Todas las campanas</option>
              {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select value={filtroCampo} onChange={(e) => setFiltroCampo(e.target.value)} className="rounded-md border border-stone-300 px-2 py-1 text-sm">
              <option value="">Todos los campos</option>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {cargando && <p className="text-sm text-stone-500">Cargando...</p>}
          {!cargando && sanidadesFiltradas.length === 0 && <p className="text-sm text-stone-500">Sin aplicaciones registradas.</p>}
          {!cargando && sanidadesFiltradas.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                  <th className="px-3 py-2 font-medium">Campana</th>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Campo / Lote</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Animales</th>
                  <th className="px-3 py-2 text-right font-medium">Total prod.</th>
                  <th className="px-3 py-2 text-right font-medium">Costo USD</th>
                  <th className="px-3 py-2" />
                </tr></thead>
                <tbody>
                  {sanidadesFiltradas.map((s) => (
                    <tr key={s.id} className="border-t border-stone-100">
                      <td className="px-3 py-2 text-stone-600">{s.campanas?.nombre ?? '-'}</td>
                      <td className="px-3 py-2 text-stone-600">{new Date(s.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                      <td className="px-3 py-2"><div className="font-medium text-stone-900">{s.campos?.nombre}</div><div className="text-xs text-stone-500">{s.lotes?.nombre ?? 'Todo el campo'}</div></td>
                      <td className="px-3 py-2 text-stone-700">{s.categorias_hacienda?.nombre ?? 'Todas'}</td>
                      <td className="px-3 py-2 text-stone-700">{s.productos_veterinarios?.nombre}</td>
                      <td className="px-3 py-2 text-right text-stone-900">{s.cantidad_animales.toLocaleString('es-AR')}</td>
                      <td className="px-3 py-2 text-right text-stone-900">{Number(s.total_producto).toLocaleString('es-AR', { maximumFractionDigits: 3 })} {s.productos_veterinarios?.unidad}</td>
                      <td className="px-3 py-2 text-right text-stone-900">{s.costo_total_usd ? 'USD ' + Number(s.costo_total_usd).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '-'}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => abrirEditSan(s)} className="text-xs text-stone-500 hover:text-stone-900 underline">Editar</button>
                          <button onClick={() => handleBorrarSan(s.id)} className="text-xs text-red-500 hover:text-red-700 underline">Borrar</button>
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

      {editSan && (
        <Modal title="Editar aplicacion sanitaria" onClose={() => setEditSan(null)}>
          {esError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{esError}</div>}
          <div><label className={labelCls}>Campana</label>
            <select value={esCampaniaId} onChange={(e) => setEsCampaniaId(e.target.value)} className={inputCls}>
              <option value="">Sin campana</option>
              {campanias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Campo</label>
            <select value={esCampoId} onChange={(e) => { setEsCampoId(e.target.value); setEsLoteId('') }} className={inputCls}>
              {campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Lote <span className="text-stone-400">(opcional)</span></label>
            <select value={esLoteId} onChange={(e) => setEsLoteId(e.target.value)} className={inputCls}>
              <option value="">Todo el campo</option>
              {lotesPorCampo(esCampoId).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Categoria <span className="text-stone-400">(opcional)</span></label>
            <select value={esCategoriaId} onChange={(e) => setEsCategoriaId(e.target.value)} className={inputCls}>
              <option value="">Todas las categorias</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></div>
          <div><label className={labelCls}>Producto</label>
            <select value={esProductoId} onChange={(e) => handleSelectProductoEdit(e.target.value)} className={inputCls}>
              <option value="">- mismo producto ({editSan.productos_veterinarios?.nombre}) -</option>
              {productosVet.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
            </select></div>
          <div><label className={labelCls}>Fecha</label>
            <input type="date" value={esFecha} onChange={(e) => setEsFecha(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Cantidad de animales</label>
            <input type="number" min={1} value={esCantidadAnimales} onChange={(e) => setEsCantidadAnimales(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Dosis por animal</label>
            <input type="number" min={0} step="0.001" value={esDosisPorAnimal} onChange={(e) => setEsDosisPorAnimal(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Precio por unidad (USD)</label>
            <input type="number" min={0} step="0.01" value={esPrecioUnitario} onChange={(e) => setEsPrecioUnitario(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Observaciones</label>
            <textarea value={esObs} onChange={(e) => setEsObs(e.target.value)} rows={2} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditSan(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditSan} disabled={esGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {esGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}

      {editProd && (
        <Modal title="Editar producto" onClose={() => setEditProd(null)}>
          {epError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{epError}</div>}
          <div><label className={labelCls}>Nombre</label>
            <input value={epNombre} onChange={(e) => setEpNombre(e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>Tipo</label>
            <select value={epTipo} onChange={(e) => setEpTipo(e.target.value)} className={inputCls}>
              {TIPOS_PRODUCTO.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select></div>
          <div><label className={labelCls}>Unidad</label>
            <select value={epUnidad} onChange={(e) => setEpUnidad(e.target.value)} className={inputCls}>
              {UNIDADES_PRODUCTO.map((u) => <option key={u} value={u}>{u}</option>)}
            </select></div>
          <div><label className={labelCls}>Precio (USD / {epUnidad})</label>
            <input type="number" min={0} step="0.01" value={epPrecio} onChange={(e) => setEpPrecio(e.target.value)} className={inputCls} /></div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setEditProd(null)} className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">Cancelar</button>
            <button onClick={handleGuardarEditProd} disabled={epGuardando} className="flex-1 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
              {epGuardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
