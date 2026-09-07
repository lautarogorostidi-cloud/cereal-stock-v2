'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Movimiento = {
  id: number
  producto_id: number
  proveedor_id: number | null
  fecha: string
  tipo: string
  cantidad: number
  campania: string | null
  observaciones: string | null
  precio_unitario: number | null
  numero_remito: string | null
  numero_factura: string | null
  fertilizantes_productos: { nombre: string; unidad: string; marca: string | null; cultivos: { nombre: string } | null } | null
  proveedores: { nombre: string } | null
}

type Producto = { id: number; nombre: string; unidad: string; marca: string | null; cultivo_id: string | null; proveedor_id: number | null; cultivos: { nombre: string } | null }
type Proveedor = { id: string; nombre: string }
type Cultivo = { id: string; nombre: string }
type Campana = { id: number; nombre: string }

const TIPOS = ['compra', 'devolucion', 'ajuste']

export default function MovimientosFertilizantesPage() {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampania, setFiltroCampania] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    producto_id: '',
    tipo: 'compra',
    fecha: new Date().toISOString().split('T')[0],
    cantidad: '',
    precio_unitario: '',
    proveedor_id: '',
    campania: '',
    numero_remito: '',
    numero_factura: '',
    observaciones: '',
  })

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('fertilizantes_movimientos')
      .select('*, fertilizantes_productos(nombre, unidad, marca, cultivos(nombre)), proveedores(nombre)')
      .order('fecha', { ascending: false })
    if (error) console.error('Error cargando movimientos:', error)
    setMovimientos((data ?? []) as any)
    setLoading(false)
  }

  async function cargarMaestros() {
    const [{ data: prods }, { data: provs }, { data: cs }, { data: caps }] = await Promise.all([
      supabase.from('fertilizantes_productos').select('id, nombre, unidad, marca, cultivo_id, proveedor_id, cultivos(nombre)').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('cultivos').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre', { ascending: false }),
    ])
    setProductos((prods ?? []) as any)
    setProveedores(provs ?? [])
    setCultivos(cs ?? [])
    setCampanas(caps ?? [])
    if (caps && caps.length > 0) setForm(f => ({ ...f, campania: caps[0].nombre }))
  }

  useEffect(() => {
    cargar()
    cargarMaestros()
  }, [])

  const [nuevoProductoMode, setNuevoProductoMode] = useState(false)
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', cultivo_id: '', unidad: 'kg', marca: '', proveedor_id: '' })
  const [savingProducto, setSavingProducto] = useState(false)
  const [errorProducto, setErrorProducto] = useState<string | null>(null)

  const [nuevoProveedorMode, setNuevoProveedorMode] = useState(false)
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', cuit: '', telefono: '', email: '' })
  const [savingProveedor, setSavingProveedor] = useState(false)

  async function handleGuardarNuevoProveedor() {
    if (!nuevoProveedor.nombre) return
    setSavingProveedor(true)
    const { data, error } = await supabase.from('proveedores').insert({
      nombre: nuevoProveedor.nombre,
      cuit: nuevoProveedor.cuit || null,
      telefono: nuevoProveedor.telefono || null,
      email: nuevoProveedor.email || null,
      activo: true,
    }).select('id, nombre').single()
    if (!error && data) {
      const { data: provs } = await supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      setProveedores(provs ?? [])
      setForm(f => ({ ...f, proveedor_id: String(data.id) }))
      setNuevoProveedorMode(false)
      setNuevoProveedor({ nombre: '', cuit: '', telefono: '', email: '' })
    }
    setSavingProveedor(false)
  }

  const UNIDADES_PRODUCTO = ['kg', 'toneladas', 'bolsas', 'litros']

  async function handleGuardarNuevoProducto() {
    if (!nuevoProducto.nombre) return
    setSavingProducto(true)
    setErrorProducto(null)
    const { data, error } = await supabase.from('fertilizantes_productos').insert({
      nombre: nuevoProducto.nombre,
      cultivo_id: nuevoProducto.cultivo_id || null,
      unidad: nuevoProducto.unidad,
      marca: nuevoProducto.marca || null,
      proveedor_id: nuevoProducto.proveedor_id || null,
      activo: true,
    }).select('id, nombre, unidad, marca, cultivo_id, proveedor_id, cultivos(nombre)').single()
    if (!error && data) {
      const nuevoId = String(data.id)
      const { data: prods } = await supabase.from('fertilizantes_productos').select('id, nombre, unidad, marca, cultivo_id, proveedor_id, cultivos(nombre)').eq('activo', true).order('nombre')
      setProductos((prods ?? []) as any)
      setNuevoProductoMode(false)
      setNuevoProducto({ nombre: '', cultivo_id: '', unidad: 'kg', marca: '', proveedor_id: '' })
      setForm(f => ({ ...f, producto_id: nuevoId, proveedor_id: nuevoProducto.proveedor_id || f.proveedor_id }))
    } else if (error) {
      if (error.code === '23505') {
        setErrorProducto('Ya existe un fertilizante con ese nombre. Cancelá y buscalo en la lista.')
      } else {
        setErrorProducto(`Error: ${error.message}`)
      }
    }
    setSavingProducto(false)
  }

  const costoTotal = Number(form.cantidad || 0) * Number(form.precio_unitario || 0)
  const productoSeleccionado = productos.find(p => String(p.id) === form.producto_id)
  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''

  // Agrupar productos por cultivo
  const productosPorCultivo = productos.reduce((acc: Record<string, Producto[]>, p) => {
    const c = p.cultivos?.nombre ?? 'General'
    if (!acc[c]) acc[c] = []
    acc[c].push(p)
    return acc
  }, {})

  async function handleGuardar() {
    setError(null)
    if (nuevoProductoMode) {
      setError('Primero guardá el nuevo fertilizante o cancelá.')
      return
    }
    if (!form.producto_id || !form.cantidad || !form.fecha) {
      setError('Completá producto, fecha y cantidad')
      return
    }
    setSaving(true)
    const payload: any = {
      producto_id: Number(form.producto_id),
      tipo: form.tipo,
      fecha: form.fecha,
      cantidad: Number(form.cantidad),
      campania: form.campania || null,
      observaciones: form.observaciones || null,
    }
    if (form.tipo === 'compra') {
      payload.precio_unitario = form.precio_unitario ? Number(form.precio_unitario) : null
      payload.proveedor_id = form.proveedor_id || null
      payload.numero_remito = form.numero_remito || null
      payload.numero_factura = form.numero_factura || null
    }
    const { error } = editandoId
      ? await supabase.from('fertilizantes_movimientos').update(payload).eq('id', editandoId)
      : await supabase.from('fertilizantes_movimientos').insert(payload)
    if (error) {
      setError(error.message)
    } else {
      // Si el fertilizante todavía no tiene un proveedor por defecto, el de esta compra queda como tal
      // (así se completa solo en Productos/Stock sin tener que cargarlo dos veces)
      if (form.tipo === 'compra' && payload.proveedor_id && productoSeleccionado && !productoSeleccionado.proveedor_id) {
        await supabase.from('fertilizantes_productos').update({ proveedor_id: payload.proveedor_id }).eq('id', payload.producto_id)
        const { data: prods } = await supabase.from('fertilizantes_productos').select('id, nombre, unidad, marca, cultivo_id, proveedor_id, cultivos(nombre)').eq('activo', true).order('nombre')
        setProductos((prods ?? []) as any)
      }
      setShowForm(false)
      setEditandoId(null)
      setForm({ producto_id: '', tipo: 'compra', fecha: new Date().toISOString().split('T')[0], cantidad: '', precio_unitario: '', proveedor_id: '', campania: campanas[0]?.nombre ?? '', numero_remito: '', numero_factura: '', observaciones: '' })
      cargar()
    }
    setSaving(false)
  }

  const [editandoId, setEditandoId] = useState<number | null>(null)

  function editarMovimiento(m: Movimiento) {
    setEditandoId(m.id)
    setForm({
      producto_id: String(m.producto_id ?? ''),
      tipo: m.tipo,
      fecha: m.fecha,
      cantidad: m.cantidad.toString(),
      precio_unitario: m.precio_unitario?.toString() ?? '',
      proveedor_id: String(m.proveedor_id ?? ''),
      campania: m.campania ?? '',
      numero_remito: m.numero_remito ?? '',
      numero_factura: m.numero_factura ?? '',
      observaciones: m.observaciones ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este movimiento?')) return
    await supabase.from('fertilizantes_movimientos').delete().eq('id', id)
    cargar()
  }

  const movFiltrados = movimientos
    .filter(m => filtroTipo ? m.tipo === filtroTipo : m.tipo !== 'ajuste')
    .filter(m => filtroCampania ? m.campania === filtroCampania : true)
    .filter(m => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        m.fertilizantes_productos?.nombre?.toLowerCase().includes(q) ||
        m.fertilizantes_productos?.cultivos?.nombre?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.campania?.toLowerCase().includes(q) ||
        m.proveedores?.nombre?.toLowerCase().includes(q) ||
        m.numero_remito?.toLowerCase().includes(q) ||
        m.numero_factura?.toLowerCase().includes(q)
      )
    })
  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const badgeColor = (tipo: string) => {
    if (tipo === 'compra')     return 'bg-blue-100 text-blue-700'
    if (tipo === 'devolucion') return 'bg-purple-100 text-purple-700'
    return 'bg-campo-100 text-campo-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Compras, devoluciones y ajustes de fertilizante</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nuevo movimiento
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Producto */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-campo-700 mb-1">Fertilizante *</label>
              {!nuevoProductoMode ? (
                <>
                  <select value={form.producto_id} onChange={e => {
                    if (e.target.value === '__nuevo__') { setNuevoProductoMode(true); return }
                    const prod = productos.find(p => String(p.id) === e.target.value)
                    setForm(f => ({ ...f, producto_id: e.target.value, proveedor_id: prod?.proveedor_id ? String(prod.proveedor_id) : f.proveedor_id }))
                  }}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccioná un fertilizante</option>
                    {Object.entries(productosPorCultivo).map(([cultivo, prods]) => (
                      <optgroup key={cultivo} label={cultivo}>
                        {prods.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` — ${p.marca}` : ''}</option>)}
                      </optgroup>
                    ))}
                    <option value="__nuevo__">➕ Agregar nuevo fertilizante...</option>
                  </select>
                </>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div className="text-xs font-medium text-emerald-700 mb-2">Nuevo fertilizante</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={nuevoProducto.nombre} onChange={e => setNuevoProducto(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre (Urea, PDA, Mezcla...) *" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <select value={nuevoProducto.cultivo_id} onChange={e => setNuevoProducto(p => ({ ...p, cultivo_id: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="">Cultivo (opcional)</option>
                      {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <input type="text" value={nuevoProducto.marca} onChange={e => setNuevoProducto(p => ({ ...p, marca: e.target.value }))}
                      placeholder="Marca (opcional)" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <select value={nuevoProducto.unidad} onChange={e => setNuevoProducto(p => ({ ...p, unidad: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      {UNIDADES_PRODUCTO.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <select value={nuevoProducto.proveedor_id} onChange={e => setNuevoProducto(p => ({ ...p, proveedor_id: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="">Proveedor (opcional)</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleGuardarNuevoProducto} disabled={savingProducto || !nuevoProducto.nombre}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      {savingProducto ? 'Guardando...' : 'Guardar fertilizante'}
                    </button>
                    <button type="button" onClick={() => { setNuevoProductoMode(false); setNuevoProducto({ nombre: '', cultivo_id: '', unidad: 'kg', marca: '', proveedor_id: '' }); setErrorProducto(null) }}
                      className="text-xs text-campo-500 hover:text-campo-700 px-3 py-1.5 rounded-lg hover:bg-campo-100 transition-colors">
                      Cancelar
                    </button>
                  </div>
                  {errorProducto && <div className="text-xs text-red-600 mt-1">{errorProducto}</div>}
                </div>
              )}
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {/* Cantidad */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">
                Cantidad * {productoSeleccionado ? `(${productoSeleccionado.unidad})` : ''}
              </label>
              <input type="number" step="0.001" min="0" value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                placeholder="0.0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {/* Campaña — para todos los tipos */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Campaña</label>
              <select value={form.campania} onChange={e => setForm(f => ({ ...f, campania: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">Sin campaña</option>
                {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
              </select>
            </div>

            {/* Campos específicos de COMPRA */}
            {form.tipo === 'compra' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">
                    Precio unitario (USD/{productoSeleccionado?.unidad ?? 'u'})
                  </label>
                  <input type="number" step="0.001" min="0" value={form.precio_unitario}
                    onChange={e => setForm(f => ({ ...f, precio_unitario: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  {costoTotal > 0 && <p className="text-xs text-campo-400 mt-1">Total: {fmtUsd(costoTotal)}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Proveedor</label>
                  {!nuevoProveedorMode ? (
                    <select value={form.proveedor_id} onChange={e => {
                      if (e.target.value === '__nuevo_prov__') { setNuevoProveedorMode(true); return }
                      setForm(f => ({ ...f, proveedor_id: e.target.value }))
                    }}
                      className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="">Sin proveedor</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      <option value="__nuevo_prov__">➕ Agregar nuevo proveedor...</option>
                    </select>
                  ) : (
                    <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="text-xs font-medium text-emerald-700 mb-2">Nuevo proveedor</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={nuevoProveedor.nombre} onChange={e => setNuevoProveedor(p => ({ ...p, nombre: e.target.value }))}
                          placeholder="Nombre *" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        <input type="text" value={nuevoProveedor.cuit} onChange={e => setNuevoProveedor(p => ({ ...p, cuit: e.target.value }))}
                          placeholder="CUIT" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        <input type="text" value={nuevoProveedor.telefono} onChange={e => setNuevoProveedor(p => ({ ...p, telefono: e.target.value }))}
                          placeholder="Teléfono" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                        <input type="text" value={nuevoProveedor.email} onChange={e => setNuevoProveedor(p => ({ ...p, email: e.target.value }))}
                          placeholder="Email" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={handleGuardarNuevoProveedor} disabled={savingProveedor || !nuevoProveedor.nombre}
                          className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                          {savingProveedor ? 'Guardando...' : 'Guardar proveedor'}
                        </button>
                        <button type="button" onClick={() => { setNuevoProveedorMode(false); setNuevoProveedor({ nombre: '', cuit: '', telefono: '', email: '' }) }}
                          className="text-xs text-campo-500 hover:text-campo-700 px-3 py-1.5 rounded-lg hover:bg-campo-100 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">N° Remito</label>
                  <input type="text" value={form.numero_remito}
                    onChange={e => setForm(f => ({ ...f, numero_remito: e.target.value }))}
                    placeholder="0001-00012345"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">N° Factura</label>
                  <input type="text" value={form.numero_factura}
                    onChange={e => setForm(f => ({ ...f, numero_factura: e.target.value }))}
                    placeholder="0001-00012345"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-campo-700 mb-1">Observaciones</label>
              <input type="text" value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                placeholder="Opcional"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={handleGuardar} disabled={saving}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
              {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setError(null); setEditandoId(null) }}
              className="text-sm text-campo-500 hover:text-campo-700 px-4 py-2 rounded-lg hover:bg-campo-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros de campaña y búsqueda */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={filtroCampania}
          onChange={e => setFiltroCampania(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="">Todas las campañas</option>
          {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <div className="flex-1">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, cultivo, campaña, proveedor, remito..."
            className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltroTipo('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filtroTipo ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
          Todos
        </button>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === t ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fertilizante</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo mov.</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Cantidad</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio/u</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Proveedor</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Observaciones</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && movFiltrados.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-campo-400">No hay movimientos registrados</td></tr>}
              {movFiltrados.map((m, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-campo-900">{m.fertilizantes_productos?.nombre ?? '—'}</div>
                    {m.fertilizantes_productos?.cultivos?.nombre && <div className="text-xs text-campo-400">{m.fertilizantes_productos.cultivos.nombre}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(m.tipo)}`}>
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-campo-900">
                    {fmt(m.cantidad)} <span className="text-xs text-campo-400">{m.fertilizantes_productos?.unidad}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-campo-600">
                    {m.precio_unitario ? `USD ${Number(m.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-campo-600">{m.proveedores?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{m.campania ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-500 text-xs">{m.observaciones ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => editarMovimiento(m)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
                      <button onClick={() => handleBorrar(m.id)} className="text-xs text-red-400 hover:text-red-600 font-medium">Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
