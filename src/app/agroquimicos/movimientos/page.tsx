'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Movimiento = {
  id: number
  fecha: string
  tipo: string
  cantidad: number
  lote: string | null
  cultivo: string | null
  campaña: string | null
  observaciones: string | null
  precio_unitario: number | null
  numero_remito: string | null
  numero_factura: string | null
  agroquimicos_productos: { nombre: string; unidad: string; tipo: string } | null
  proveedores: { nombre: string } | null
}

type Producto = { id: number; nombre: string; unidad: string; marca: string; tipo: string }
type Proveedor = { id: string; nombre: string }
type Lote = { id: string; nombre: string; establecimiento: string }
type Cultivo = { id: string; nombre: string }
type Campana = { id: number; nombre: string }

const TIPOS = ['compra', 'aplicacion', 'devolucion', 'ajuste']

export default function MovimientosPage() {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCampana, setFiltroCampana] = useState('')
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
    lote: '',
    cultivo: '',
    campaña: '',
    numero_remito: '',
    numero_factura: '',
    observaciones: '',
  })

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('agroquimicos_movimientos')
      .select('*, agroquimicos_productos(nombre, unidad, tipo)')
      .order('fecha', { ascending: false })
    if (error) console.error('Error cargando movimientos:', error)
    setMovimientos(data ?? [])
    setLoading(false)
  }

  async function cargarMaestros() {
    const [{ data: prods }, { data: provs }, { data: ls }, { data: cs }, { data: caps }] = await Promise.all([
      supabase.from('agroquimicos_productos').select('id, nombre, unidad, marca, tipo').eq('activo', true).order('tipo').order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('lotes').select('id, nombre, establecimiento').order('establecimiento').order('nombre'),
      supabase.from('cultivos').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre', { ascending: false }),
    ])
    setProductos(prods ?? [])
    setProveedores(provs ?? [])
    setLotes(ls ?? [])
    setCultivos(cs ?? [])
    setCampanas(caps ?? [])
    if (caps && caps.length > 0) setForm(f => ({ ...f, campaña: caps[0].nombre }))
  }

  useEffect(() => {
    cargar()
    cargarMaestros()
  }, [])

  const [nuevoProductoMode, setNuevoProductoMode] = useState(false)
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', tipo: '', unidad: 'L', marca: '' })
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

  const TIPOS_PRODUCTO = ['herbicida', 'fungicida', 'insecticida', 'acaricida', 'curasemilla', 'coadyuvante', 'otro']
  const UNIDADES_PRODUCTO = ['L', 'kg', 'cc', 'g', 'u']

  async function handleGuardarNuevoProducto() {
    if (!nuevoProducto.nombre || !nuevoProducto.tipo) return
    setSavingProducto(true)
    setErrorProducto(null)
    const { data, error } = await supabase.from('agroquimicos_productos').insert({
      nombre: nuevoProducto.nombre,
      tipo: nuevoProducto.tipo,
      unidad: nuevoProducto.unidad,
      marca: nuevoProducto.marca || null,
      activo: true,
    }).select('id, nombre, unidad, marca, tipo').single()
    if (!error && data) {
      const nuevoId = String(data.id)
      const { data: prods } = await supabase.from('agroquimicos_productos').select('id, nombre, unidad, marca, tipo').eq('activo', true).order('tipo').order('nombre')
      setProductos(prods ?? [])
      setNuevoProductoMode(false)
      setNuevoProducto({ nombre: '', tipo: '', unidad: 'L', marca: '' })
      setForm(f => ({ ...f, producto_id: nuevoId }))
    } else if (error) {
      if (error.code === '23505') {
        setErrorProducto('Ya existe un producto con ese nombre. Cancelá y buscalo en la lista.')
      } else {
        setErrorProducto(`Error: ${error.message}`)
      }
    }
    setSavingProducto(false)
  }
  const costoTotal = Number(form.cantidad || 0) * Number(form.precio_unitario || 0)
  const productoSeleccionado = productos.find(p => String(p.id) === form.producto_id)
  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''

  // Agrupar productos por tipo
  const productosPorTipo = productos.reduce((acc: Record<string, Producto[]>, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = []
    acc[p.tipo].push(p)
    return acc
  }, {})

  async function handleGuardar() {
    setError(null)
    if (nuevoProductoMode) {
      setError('Primero guardá el nuevo producto o cancelá.')
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
      campaña: form.campaña || null,
      observaciones: form.observaciones || null,
    }
    if (form.tipo === 'compra') {
      payload.precio_unitario = form.precio_unitario ? Number(form.precio_unitario) : null
      payload.proveedor_id = form.proveedor_id || null
      payload.numero_remito = form.numero_remito || null
      payload.numero_factura = form.numero_factura || null
    }
    if (form.tipo === 'aplicacion') {
      payload.lote = form.lote || null
      payload.cultivo = form.cultivo || null
      payload.campaña = form.campaña || null
    }
    const { error } = editandoId
      ? await supabase.from('agroquimicos_movimientos').update(payload).eq('id', editandoId)
      : await supabase.from('agroquimicos_movimientos').insert(payload)
    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setEditandoId(null)
      setForm({ producto_id: '', tipo: 'compra', fecha: new Date().toISOString().split('T')[0], cantidad: '', precio_unitario: '', proveedor_id: '', lote: '', cultivo: '', campaña: campanas[0]?.nombre ?? '', numero_remito: '', numero_factura: '', observaciones: '' })
      cargar()
    }
    setSaving(false)
  }

  const [editandoId, setEditandoId] = useState<number | null>(null)

  function editarMovimiento(m: Movimiento) {
    setEditandoId(m.id)
    setForm({
      producto_id: String(m.agroquimicos_productos ? (movimientos.find(x => x.id === m.id) as any)?.producto_id ?? '' : ''),
      tipo: m.tipo,
      fecha: m.fecha,
      cantidad: m.cantidad.toString(),
      precio_unitario: m.precio_unitario?.toString() ?? '',
      proveedor_id: '',
      lote: m.lote ?? '',
      cultivo: m.cultivo ?? '',
      campaña: m.campaña ?? '',
      numero_remito: m.numero_remito ?? '',
      numero_factura: m.numero_factura ?? '',
      observaciones: m.observaciones ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este movimiento?')) return
    await supabase.from('agroquimicos_movimientos').delete().eq('id', id)
    cargar()
  }

  const movFiltrados = movimientos
    .filter(m => filtroTipo ? m.tipo === filtroTipo : m.tipo !== 'ajuste')
    .filter(m => filtroCampana ? m.campaña === filtroCampana : true)
    .filter(m => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        m.agroquimicos_productos?.nombre?.toLowerCase().includes(q) ||
        m.agroquimicos_productos?.tipo?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.cultivo?.toLowerCase().includes(q) ||
        m.campaña?.toLowerCase().includes(q) ||
        m.lote?.toLowerCase().includes(q) ||
        m.proveedores?.nombre?.toLowerCase().includes(q) ||
        m.numero_remito?.toLowerCase().includes(q) ||
        m.numero_factura?.toLowerCase().includes(q)
      )
    })
  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const badgeColor = (tipo: string) => {
    if (tipo === 'compra')     return 'bg-blue-100 text-blue-700'
    if (tipo === 'aplicacion') return 'bg-orange-100 text-orange-700'
    if (tipo === 'devolucion') return 'bg-purple-100 text-purple-700'
    return 'bg-campo-100 text-campo-600'
  }

  const lotesPorCampo = lotes.reduce((acc: Record<string, Lote[]>, l) => {
    if (!acc[l.establecimiento]) acc[l.establecimiento] = []
    acc[l.establecimiento].push(l)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Compras, aplicaciones y devoluciones</p>
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
              <label className="block text-xs font-medium text-campo-700 mb-1">Producto *</label>
              {!nuevoProductoMode ? (
                <>
                  <select value={form.producto_id} onChange={e => {
                    if (e.target.value === '__nuevo__') { setNuevoProductoMode(true); return }
                    setForm(f => ({ ...f, producto_id: e.target.value }))
                  }}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccioná un producto</option>
                    {Object.entries(productosPorTipo).map(([tipo, prods]) => (
                      <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                        {prods.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` — ${p.marca}` : ''}</option>)}
                      </optgroup>
                    ))}
                    <option value="__nuevo__">➕ Agregar nuevo producto...</option>
                  </select>
                </>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div className="text-xs font-medium text-emerald-700 mb-2">Nuevo producto</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={nuevoProducto.nombre} onChange={e => setNuevoProducto(p => ({ ...p, nombre: e.target.value }))}
                      placeholder="Nombre *" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <select value={nuevoProducto.tipo} onChange={e => setNuevoProducto(p => ({ ...p, tipo: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="">Tipo *</option>
                      {TIPOS_PRODUCTO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="text" value={nuevoProducto.marca} onChange={e => setNuevoProducto(p => ({ ...p, marca: e.target.value }))}
                      placeholder="Marca" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <select value={nuevoProducto.unidad} onChange={e => setNuevoProducto(p => ({ ...p, unidad: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      {UNIDADES_PRODUCTO.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleGuardarNuevoProducto} disabled={savingProducto || !nuevoProducto.nombre || !nuevoProducto.tipo}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      {savingProducto ? 'Guardando...' : 'Guardar producto'}
                    </button>
                    <button type="button" onClick={() => { setNuevoProductoMode(false); setNuevoProducto({ nombre: '', tipo: '', unidad: 'L', marca: '' }); setErrorProducto(null) }}
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
              <select value={form.campaña} onChange={e => setForm(f => ({ ...f, campaña: e.target.value }))}
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

            {/* Campos específicos de APLICACION */}
            {form.tipo === 'aplicacion' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Lote</label>
                  <select value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccioná un lote</option>
                    {Object.entries(lotesPorCampo).map(([campo, ls]) => (
                      <optgroup key={campo} label={campo}>
                        {ls.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Cultivo</label>
                  <select value={form.cultivo} onChange={e => setForm(f => ({ ...f, cultivo: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccioná un cultivo</option>
                    {cultivos.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Campaña</label>
                  <select value={form.campaña} onChange={e => setForm(f => ({ ...f, campaña: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
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
          value={filtroCampana}
          onChange={e => setFiltroCampana(e.target.value)}
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
            placeholder="Buscar por producto, tipo, cultivo, campaña, proveedor, remito..."
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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Producto</th>
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
              {loading && <tr><td colSpan={10} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && movFiltrados.length === 0 && <tr><td colSpan={10} className="px-5 py-10 text-center text-campo-400">No hay movimientos registrados</td></tr>}
              {movFiltrados.map((m, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-campo-900">{m.agroquimicos_productos?.nombre ?? '—'}</div>
                    {m.agroquimicos_productos?.tipo && <div className="text-xs text-campo-400">{m.agroquimicos_productos.tipo}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(m.tipo)}`}>
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-campo-900">
                    {fmt(m.cantidad)} <span className="text-xs text-campo-400">{m.agroquimicos_productos?.unidad}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-campo-600">
                    {m.precio_unitario ? `USD ${Number(m.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-campo-600">{m.proveedores?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{m.campaña ?? '—'}</td>
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
