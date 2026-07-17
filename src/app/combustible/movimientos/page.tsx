'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Movimiento = {
  id: number
  tipo: string
  fecha: string
  litros: number
  precio_unitario: number | null
  numero_remito: string | null
  numero_factura: string | null
  observaciones: string | null
  tanque_id: number
  maquina_id: number | null
  proveedor_id: number | null
  combustible_tanques: { nombre: string; combustible: string } | null
  combustible_maquinas: { nombre: string } | null
  proveedores: { nombre: string } | null
}

type Tanque = { id: number; nombre: string; combustible: string; activo: boolean }
type Maquina = { id: number; nombre: string; tipo: string; activo: boolean }
type Proveedor = { id: number; nombre: string }

const TIPOS = ['ingreso', 'consumo', 'ajuste']

export default function MovimientosCombustiblePage() {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [tanques, setTanques] = useState<Tanque[]>([])
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const vacio = {
    tipo: 'consumo',
    fecha: new Date().toISOString().split('T')[0],
    tanque_id: '',
    maquina_id: '',
    litros: '',
    precio_unitario: '',
    proveedor_id: '',
    numero_remito: '',
    numero_factura: '',
    observaciones: '',
  }
  const [form, setForm] = useState(vacio)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('combustible_movimientos')
      .select('*, combustible_tanques(nombre, combustible), combustible_maquinas(nombre), proveedores(nombre)')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
    if (error) console.error('Error cargando movimientos:', error)
    setMovimientos(data ?? [])
    setLoading(false)
  }

  async function cargarMaestros() {
    const [{ data: ts }, { data: ms }, { data: ps }] = await Promise.all([
      supabase.from('combustible_tanques').select('id, nombre, combustible, activo').eq('activo', true).order('nombre'),
      supabase.from('combustible_maquinas').select('id, nombre, tipo, activo').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setTanques(ts ?? [])
    setMaquinas(ms ?? [])
    setProveedores(ps ?? [])
  }

  useEffect(() => { cargar(); cargarMaestros() }, [])

  // ── Alta rápida de tanque ──
  const [nuevoTanqueMode, setNuevoTanqueMode] = useState(false)
  const [nuevoTanque, setNuevoTanque] = useState({ nombre: '', tipo: 'fijo', combustible: 'gasoil' })
  const [savingTanque, setSavingTanque] = useState(false)

  async function handleGuardarNuevoTanque() {
    if (!nuevoTanque.nombre) return
    setSavingTanque(true)
    const { data, error } = await supabase.from('combustible_tanques').insert({
      nombre: nuevoTanque.nombre, tipo: nuevoTanque.tipo, combustible: nuevoTanque.combustible, activo: true,
    }).select('id, nombre, combustible, activo').single()
    if (!error && data) {
      const { data: ts } = await supabase.from('combustible_tanques').select('id, nombre, combustible, activo').eq('activo', true).order('nombre')
      setTanques(ts ?? [])
      setForm(f => ({ ...f, tanque_id: String(data.id) }))
      setNuevoTanqueMode(false)
      setNuevoTanque({ nombre: '', tipo: 'fijo', combustible: 'gasoil' })
    }
    setSavingTanque(false)
  }

  // ── Alta rápida de máquina ──
  const [nuevaMaquinaMode, setNuevaMaquinaMode] = useState(false)
  const [nuevaMaquina, setNuevaMaquina] = useState({ nombre: '', tipo: 'tractor' })
  const [savingMaquina, setSavingMaquina] = useState(false)
  const TIPOS_MAQUINA = ['tractor', 'cosechadora', 'pulverizadora', 'camioneta', 'camion', 'otro']

  async function handleGuardarNuevaMaquina() {
    if (!nuevaMaquina.nombre) return
    setSavingMaquina(true)
    const { data, error } = await supabase.from('combustible_maquinas').insert({
      nombre: nuevaMaquina.nombre, tipo: nuevaMaquina.tipo, activo: true,
    }).select('id, nombre, tipo, activo').single()
    if (!error && data) {
      const { data: ms } = await supabase.from('combustible_maquinas').select('id, nombre, tipo, activo').eq('activo', true).order('nombre')
      setMaquinas(ms ?? [])
      setForm(f => ({ ...f, maquina_id: String(data.id) }))
      setNuevaMaquinaMode(false)
      setNuevaMaquina({ nombre: '', tipo: 'tractor' })
    }
    setSavingMaquina(false)
  }

  // ── Alta rápida de proveedor ──
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
      const { data: ps } = await supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre')
      setProveedores(ps ?? [])
      setForm(f => ({ ...f, proveedor_id: String(data.id) }))
      setNuevoProveedorMode(false)
      setNuevoProveedor({ nombre: '', cuit: '', telefono: '', email: '' })
    }
    setSavingProveedor(false)
  }

  const costoTotal = Number(form.litros || 0) * Number(form.precio_unitario || 0)
  const fmtUsd = (n: number) => n > 0 ? `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : ''

  async function handleGuardar() {
    setError(null)
    if (nuevoTanqueMode || nuevaMaquinaMode || nuevoProveedorMode) { setError('Primero guardá o cancelá el alta rápida.'); return }
    if (!form.tanque_id || !form.litros || !form.fecha) { setError('Completá tanque, fecha y litros'); return }
    if (form.tipo === 'consumo' && !form.maquina_id) { setError('Seleccioná la máquina que recibe el combustible'); return }
    setSaving(true)
    const payload: any = {
      tipo: form.tipo,
      fecha: form.fecha,
      tanque_id: Number(form.tanque_id),
      litros: Number(form.litros),
      observaciones: form.observaciones || null,
      maquina_id: form.tipo === 'consumo' && form.maquina_id ? Number(form.maquina_id) : null,
    }
    if (form.tipo === 'ingreso') {
      payload.precio_unitario = form.precio_unitario ? Number(form.precio_unitario) : null
      payload.proveedor_id = form.proveedor_id ? Number(form.proveedor_id) : null
      payload.numero_remito = form.numero_remito || null
      payload.numero_factura = form.numero_factura || null
    }
    const { error } = editandoId
      ? await supabase.from('combustible_movimientos').update(payload).eq('id', editandoId)
      : await supabase.from('combustible_movimientos').insert(payload)
    if (error) {
      setError(error.message)
    } else {
      setShowForm(false)
      setEditandoId(null)
      setForm(vacio)
      cargar()
    }
    setSaving(false)
  }

  function editar(m: Movimiento) {
    setEditandoId(m.id)
    setForm({
      tipo: m.tipo,
      fecha: m.fecha,
      tanque_id: String(m.tanque_id),
      maquina_id: m.maquina_id ? String(m.maquina_id) : '',
      litros: m.litros.toString(),
      precio_unitario: m.precio_unitario?.toString() ?? '',
      proveedor_id: m.proveedor_id ? String(m.proveedor_id) : '',
      numero_remito: m.numero_remito ?? '',
      numero_factura: m.numero_factura ?? '',
      observaciones: m.observaciones ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleBorrar(id: number) {
    if (!confirm('¿Borrar este movimiento?')) return
    await supabase.from('combustible_movimientos').delete().eq('id', id)
    cargar()
  }

  const movFiltrados = movimientos
    .filter(m => filtroTipo ? m.tipo === filtroTipo : true)
    .filter(m => {
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return (
        m.combustible_tanques?.nombre?.toLowerCase().includes(q) ||
        m.combustible_maquinas?.nombre?.toLowerCase().includes(q) ||
        m.proveedores?.nombre?.toLowerCase().includes(q) ||
        m.numero_remito?.toLowerCase().includes(q) ||
        m.numero_factura?.toLowerCase().includes(q)
      )
    })

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const badgeColor = (tipo: string) => {
    if (tipo === 'ingreso') return 'bg-blue-100 text-blue-700'
    if (tipo === 'consumo') return 'bg-orange-100 text-orange-700'
    return 'bg-campo-100 text-campo-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Ingresos (compras) y consumos de combustible</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditandoId(null); setForm(vacio) }}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nuevo movimiento
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value, maquina_id: e.target.value !== 'consumo' ? '' : f.maquina_id }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="ingreso">Ingreso (compra)</option>
                <option value="consumo">Consumo (carga a máquina)</option>
                <option value="ajuste">Ajuste</option>
              </select>
            </div>

            {/* Fecha */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {/* Litros */}
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Litros *</label>
              <input type="number" step="0.01" min="0" value={form.litros}
                onChange={e => setForm(f => ({ ...f, litros: e.target.value }))}
                placeholder="0.0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {/* Tanque */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-campo-700 mb-1">
                Tanque * {form.tipo === 'ingreso' ? '(al que ingresa)' : form.tipo === 'consumo' ? '(del que sale)' : ''}
              </label>
              {!nuevoTanqueMode ? (
                <select value={form.tanque_id} onChange={e => {
                  if (e.target.value === '__nuevo__') { setNuevoTanqueMode(true); return }
                  setForm(f => ({ ...f, tanque_id: e.target.value }))
                }}
                  className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  <option value="">Seleccioná un tanque</option>
                  {tanques.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.combustible})</option>)}
                  <option value="__nuevo__">➕ Agregar nuevo tanque...</option>
                </select>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div className="text-xs font-medium text-emerald-700 mb-2">Nuevo tanque</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={nuevoTanque.nombre} onChange={e => setNuevoTanque(t => ({ ...t, nombre: e.target.value }))}
                      placeholder="Nombre *" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                    <select value={nuevoTanque.tipo} onChange={e => setNuevoTanque(t => ({ ...t, tipo: e.target.value }))}
                      className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                      <option value="fijo">Fijo (cisterna)</option>
                      <option value="movil">Móvil (petrolero)</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={handleGuardarNuevoTanque} disabled={savingTanque || !nuevoTanque.nombre}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      {savingTanque ? 'Guardando...' : 'Guardar tanque'}
                    </button>
                    <button type="button" onClick={() => { setNuevoTanqueMode(false); setNuevoTanque({ nombre: '', tipo: 'fijo', combustible: 'gasoil' }) }}
                      className="text-xs text-campo-500 hover:text-campo-700 px-3 py-1.5 rounded-lg hover:bg-campo-100 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Máquina — solo para consumo */}
            {form.tipo === 'consumo' && (
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-campo-700 mb-1">Máquina / vehículo *</label>
                {!nuevaMaquinaMode ? (
                  <select value={form.maquina_id} onChange={e => {
                    if (e.target.value === '__nueva__') { setNuevaMaquinaMode(true); return }
                    setForm(f => ({ ...f, maquina_id: e.target.value }))
                  }}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <option value="">Seleccioná una máquina</option>
                    {maquinas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    <option value="__nueva__">➕ Agregar nueva máquina...</option>
                  </select>
                ) : (
                  <div className="space-y-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                    <div className="text-xs font-medium text-emerald-700 mb-2">Nueva máquina</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={nuevaMaquina.nombre} onChange={e => setNuevaMaquina(m => ({ ...m, nombre: e.target.value }))}
                        placeholder="Nombre *" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                      <select value={nuevaMaquina.tipo} onChange={e => setNuevaMaquina(m => ({ ...m, tipo: e.target.value }))}
                        className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                        {TIPOS_MAQUINA.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={handleGuardarNuevaMaquina} disabled={savingMaquina || !nuevaMaquina.nombre}
                        className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                        {savingMaquina ? 'Guardando...' : 'Guardar máquina'}
                      </button>
                      <button type="button" onClick={() => { setNuevaMaquinaMode(false); setNuevaMaquina({ nombre: '', tipo: 'tractor' }) }}
                        className="text-xs text-campo-500 hover:text-campo-700 px-3 py-1.5 rounded-lg hover:bg-campo-100 transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campos específicos de INGRESO */}
            {form.tipo === 'ingreso' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Precio unitario (USD/L)</label>
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
            <button onClick={() => { setShowForm(false); setError(null); setEditandoId(null); setForm(vacio) }}
              className="text-sm text-campo-500 hover:text-campo-700 px-4 py-2 rounded-lg hover:bg-campo-100 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex-1">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por tanque, máquina, proveedor, remito..."
            className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>
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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Tanque</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Máquina</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Litros</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio/L</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Proveedor</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Observaciones</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && movFiltrados.length === 0 && <tr><td colSpan={9} className="px-5 py-10 text-center text-campo-400">No hay movimientos registrados</td></tr>}
              {movFiltrados.map(m => (
                <tr key={m.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(m.tipo)}`}>
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-campo-900 font-medium">{m.combustible_tanques?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-600">{m.combustible_maquinas?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-900">{fmt(m.litros)} <span className="text-xs text-campo-400">L</span></td>
                  <td className="px-4 py-3 text-right text-campo-600">
                    {m.precio_unitario ? `USD ${Number(m.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-campo-600">{m.proveedores?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-campo-500 text-xs">{m.observaciones ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => editar(m)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
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
