'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campo = { id: number; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type CategoriaHacienda = { id: string; nombre: string; orden: number }
type ProductoVeterinario = { id: string; nombre: string; tipo: string; unidad: string }
type SanidadRow = {
  id: string; campo_id: number; lote_id: string | null; categoria_id: string | null
  fecha: string; cantidad_animales: number; dosis_por_animal: number; total_producto: number
  observaciones: string | null
  productos_veterinarios: { nombre: string; unidad: string }
  lotes: { nombre: string } | null
  categorias_hacienda: { nombre: string } | null
  campos: { nombre: string }
}

const TIPOS_PRODUCTO = ['vacuna', 'antiparasitario', 'antibiotico', 'vitamina', 'otro']
const UNIDADES_PRODUCTO = ['ml', 'cc', 'comprimido', 'dosis', 'g', 'otro']
const inputCls = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-stone-700'

export default function SanidadPage() {
  const supabase = createClient()
  const [campos, setCampos] = useState<Campo[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [categorias, setCategorias] = useState<CategoriaHacienda[]>([])
  const [productosVet, setProductosVet] = useState<ProductoVeterinario[]>([])
  const [sCampoId, setSCampoId] = useState('')
  const [sLoteId, setSLoteId] = useState('')
  const [sCategoriaId, setSCategoriaId] = useState('')
  const [sProductoId, setSProductoId] = useState('')
  const [sFecha, setSFecha] = useState(new Date().toISOString().slice(0, 10))
  const [sCantidadAnimales, setSCantidadAnimales] = useState('')
  const [sDosisPorAnimal, setSDosisPorAnimal] = useState('')
  const [sObservaciones, setSObservaciones] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [sanidades, setSanidades] = useState<SanidadRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [showNuevoProducto, setShowNuevoProducto] = useState(false)
  const [npNombre, setNpNombre] = useState('')
  const [npTipo, setNpTipo] = useState('vacuna')
  const [npUnidad, setNpUnidad] = useState('ml')
  const [npGuardando, setNpGuardando] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      const [{ data: c }, { data: l }, { data: cat }, { data: prod }] = await Promise.all([
        supabase.from('campos').select('id, nombre').order('nombre'),
        supabase.from('lotes').select('id, nombre, establecimiento').eq('activo', true).order('nombre'),
        supabase.from('categorias_hacienda').select('id, nombre, orden').order('orden'),
        supabase.from('productos_veterinarios').select('id, nombre, tipo, unidad').eq('activo', true).order('nombre'),
      ])
      setCampos(c ?? []); setLotes(l ?? []); setCategorias(cat ?? []); setProductosVet(prod ?? [])
    }
    cargar(); cargarSanidad()
  }, [])

  const cargarSanidad = async () => {
    setCargando(true)
    const { data } = await supabase.from('sanidad_hacienda')
      .select('*, productos_veterinarios(nombre, unidad), lotes(nombre), categorias_hacienda(nombre), campos(nombre)')
      .order('fecha', { ascending: false })
    setSanidades((data ?? []) as SanidadRow[]); setCargando(false)
  }

  const nombreCampo = (id: string) => campos.find((c) => c.id === Number(id))?.nombre ?? ''
  const lotesPorCampo = (campoIdStr: string) =>
    campoIdStr ? lotes.filter((l) => l.establecimiento === nombreCampo(campoIdStr)) : lotes

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setExito(null)
    if (!sCampoId) return setError('Seleccioná un campo.')
    if (!sProductoId) return setError('Seleccioná un producto.')
    if (!sCantidadAnimales || Number(sCantidadAnimales) <= 0) return setError('Ingresá la cantidad de animales.')
    if (!sDosisPorAnimal || Number(sDosisPorAnimal) <= 0) return setError('Ingresá la dosis por animal.')
    setGuardando(true)
    try {
      const { error: eIns } = await supabase.from('sanidad_hacienda').insert({ campo_id: Number(sCampoId), lote_id: sLoteId || null, categoria_id: sCategoriaId || null, producto_id: sProductoId, fecha: sFecha, cantidad_animales: Number(sCantidadAnimales), dosis_por_animal: Number(sDosisPorAnimal), observaciones: sObservaciones || null })
      if (eIns) throw eIns
      setExito('Aplicación registrada.'); setSLoteId(''); setSCategoriaId(''); setSProductoId(''); setSCantidadAnimales(''); setSDosisPorAnimal(''); setSObservaciones('')
      cargarSanidad()
    } catch (err: any) { setError(err?.message ?? 'Error al guardar.') }
    finally { setGuardando(false) }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Sanidad</h1>
        <p className="text-sm text-stone-500">Registrá aplicaciones sanitarias: vacunas, antiparasitarios y tratamientos.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-base font-semibold text-stone-900">Nueva aplicación</h2>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {exito && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{exito}</div>}

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

          <div>
            <label className={labelCls}>Dosis por animal {productoSeleccionado ? `(${productoSeleccionado.unidad})` : ''}</label>
            <input type="number" min={0} step="0.001" value={sDosisPorAnimal} onChange={(e) => setSDosisPorAnimal(e.target.value)} className={inputCls} />
            {sCantidadAnimales && sDosisPorAnimal && totalProducto > 0 && (
              <p className="mt-1 text-xs text-stone-500">Total: {totalProducto.toLocaleString('es-AR', { maximumFractionDigits: 3 })} {productoSeleccionado?.unidad}</p>
            )}
          </div>

          <div><label className={labelCls}>Observaciones</label>
            <textarea value={sObservaciones} onChange={(e) => setSObservaciones(e.target.value)} rows={2} className={inputCls} /></div>

          <button type="submit" disabled={guardando} className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar aplicación'}
          </button>
        </form>

        <div>
          <h2 className="mb-3 text-base font-semibold text-stone-900">Historial</h2>
          {cargando && <p className="text-sm text-stone-500">Cargando...</p>}
          {!cargando && sanidades.length === 0 && <p className="text-sm text-stone-500">Sin aplicaciones registradas.</p>}
          {!cargando && sanidades.length > 0 && (
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
    </div>
  )
}
