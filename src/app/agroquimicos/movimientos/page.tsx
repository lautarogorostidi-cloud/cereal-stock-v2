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
    const { data } = await supabase
      .from('agroquimicos_movimientos')
      .select('*, agroquimicos_productos(nombre, unidad, tipo), proveedores(nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
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

  const productoSeleccionado = productos.find(p => String(p.id) === form.producto_id)
  const costoTotal = Number(form.cantidad || 0) * Number(form.precio_unitario || 0)
  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''

  // Agrupar productos por tipo
  const productosPorTipo = productos.reduce((acc: Record<string, Producto[]>, p) => {
    if (!acc[p.tipo]) acc[p.tipo] = []
    acc[p.tipo].push(p)
    return acc
  }, {})

  async function handleGuardar() {
    setError(null)
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
    const { error } = await supabase.from('agroquimicos_movimientos').insert(payload)
    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setForm({ producto_id: '', tipo: 'compra', fecha: new Date().toISOString().split('T')[0], cantidad: '', precio_unitario: '', proveedor_id: '', lote: '', cultivo: '', campaña: campanas[0]?.nombre ?? '', numero_remito: '', numero_factura: '', observaciones: '' })
      cargar()
    }
    setSaving(false)
  }

  const movFiltrados = filtroTipo ? movimientos.filter(m => m.tipo === filtroTipo) : movimientos
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
          <h2 className="font-semibold text-campo-900">Nuevo movimiento</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Producto */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-campo-700 mb-1">Producto *</label>
              <select value={form.producto_id} onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">Seleccioná un producto</option>
                {Object.entries(productosPorTipo).map(([tipo, prods]) => (
                  <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                    {prods.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.marca ? ` — ${p.marca}` : ''}</option>)}
                  </optgroup>
                ))}
              </select>
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
                  <select value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
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
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => { setShowForm(false); setError(null) }}
              className="text-sm text-campo-500 hover:text-campo-700 px-4 py-2 rounded-lg hover:bg-campo-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Observaciones</th>
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
                  <td className="px-4 py-3 text-campo-600">{m.lote ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{m.cultivo ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{m.campaña ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-500 text-xs">{m.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
