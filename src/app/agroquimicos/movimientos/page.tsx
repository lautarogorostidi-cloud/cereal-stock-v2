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
  agroquimicos_productos: { nombre: string; unidad: string } | null
}

type Producto = {
  id: number
  nombre: string
  unidad: string
  marca: string
}

const TIPOS = ['compra', 'aplicacion', 'devolucion', 'ajuste']
const CULTIVOS = ['soja', 'trigo', 'maiz', 'girasol', 'centeno', 'cebada', 'sorgo', 'otro']
const CAMPANIAS = ['25-26', '24-25', '23-24']

export default function MovimientosPage() {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
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
    lote: '',
    cultivo: '',
    campaña: '25-26',
    observaciones: '',
  })

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('agroquimicos_movimientos')
      .select('*, agroquimicos_productos(nombre, unidad)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    setMovimientos(data ?? [])
    setLoading(false)
  }

  async function cargarProductos() {
    const { data } = await supabase
      .from('agroquimicos_productos')
      .select('id, nombre, unidad, marca')
      .eq('activo', true)
      .order('nombre')
    setProductos(data ?? [])
  }

  useEffect(() => {
    cargar()
    cargarProductos()
  }, [])

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
      setForm({ producto_id: '', tipo: 'compra', fecha: new Date().toISOString().split('T')[0], cantidad: '', lote: '', cultivo: '', campaña: '25-26', observaciones: '' })
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Movimientos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Compras, aplicaciones y devoluciones</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nuevo movimiento
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">Nuevo movimiento</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Producto *</label>
              <select
                value={form.producto_id}
                onChange={e => setForm(f => ({ ...f, producto_id: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Seleccioná un producto</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} — {p.marca}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {TIPOS.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Cantidad *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.cantidad}
                onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                placeholder="0.0"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {form.tipo === 'aplicacion' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Lote</label>
                  <input
                    type="text"
                    value={form.lote}
                    onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                    placeholder="Ej: Lote 5"
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Cultivo</label>
                  <select
                    value={form.cultivo}
                    onChange={e => setForm(f => ({ ...f, cultivo: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="">Seleccioná</option>
                    {CULTIVOS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-campo-700 mb-1">Campaña</label>
                  <select
                    value={form.campaña}
                    onChange={e => setForm(f => ({ ...f, campaña: e.target.value }))}
                    className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    {CAMPANIAS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-campo-700 mb-1">Observaciones</label>
              <input
                type="text"
                value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                placeholder="Opcional"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null) }}
              className="text-sm text-campo-500 hover:text-campo-700 px-4 py-2 rounded-lg hover:bg-campo-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroTipo('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filtroTipo ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}
        >
          Todos
        </button>
        {TIPOS.map(t => (
          <button
            key={t}
            onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtroTipo === t ? 'bg-emerald-700 text-white' : 'bg-campo-100 text-campo-600 hover:bg-campo-200'}`}
          >
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
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Producto</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Cantidad</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>
              )}
              {!loading && movFiltrados.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-campo-400">No hay movimientos registrados</td></tr>
              )}
              {movFiltrados.map((m, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 text-campo-600">
                    {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-5 py-3 font-medium text-campo-900">
                    {m.agroquimicos_productos?.nombre ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(m.tipo)}`}>
                      {m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">
                    {fmt(m.cantidad)} <span className="text-xs text-campo-400">{m.agroquimicos_productos?.unidad}</span>
                  </td>
                  <td className="px-5 py-3 text-campo-600">{m.lote ?? '—'}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{m.cultivo ?? '—'}</td>
                  <td className="px-5 py-3 text-campo-600">{m.campaña ?? '—'}</td>
                  <td className="px-5 py-3 text-campo-500 text-xs">{m.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
