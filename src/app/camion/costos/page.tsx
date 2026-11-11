'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { CATEGORIAS_COSTO, CostoCamion, etiquetaCategoria, fmtUsd, fmtNum, fmtFecha, hoy, n } from '@/lib/camion'

const vacio = { fecha: hoy(), categoria: 'combustible', descripcion: '', litros: '', monto_usd: '', proveedor: '', comprobante: '', observaciones: '' }

export default function CostosCamionPage() {
  const supabase = createClient()
  const [costos, setCostos] = useState<CostoCamion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroCat, setFiltroCat] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [busqueda, setBusqueda] = useState('')

  async function cargar() {
    setLoading(true)
    const { data } = await fetchAllRows<CostoCamion>(() =>
      supabase.from('camion_costos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }))
    setCostos(data ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return costos.filter(c => {
      if (filtroCat && c.categoria !== filtroCat) return false
      if (desde && c.fecha < desde) return false
      if (hasta && c.fecha > hasta) return false
      if (!q) return true
      return [c.descripcion, c.proveedor, c.comprobante, c.observaciones].some(x => (x ?? '').toLowerCase().includes(q))
    })
  }, [costos, filtroCat, desde, hasta, busqueda])

  const porCategoria = useMemo(() => {
    const m: Record<string, number> = {}
    filtrados.forEach(c => { m[c.categoria] = (m[c.categoria] ?? 0) + n(c.monto_usd) })
    return m
  }, [filtrados])
  const total = filtrados.reduce((a, c) => a + n(c.monto_usd), 0)
  const litros = filtrados.filter(c => c.categoria === 'combustible').reduce((a, c) => a + n(c.litros), 0)
  const usdCombustible = porCategoria['combustible'] ?? 0

  async function guardar() {
    setError(null)
    if (!form.fecha || !form.categoria || form.monto_usd === '') { setError('Completá fecha, categoría y monto en USD.'); return }
    setSaving(true)
    const payload = {
      fecha: form.fecha,
      categoria: form.categoria,
      descripcion: form.descripcion || null,
      litros: form.categoria === 'combustible' && form.litros ? Number(form.litros) : null,
      monto_usd: Number(form.monto_usd),
      proveedor: form.proveedor || null,
      comprobante: form.comprobante || null,
      observaciones: form.observaciones || null,
    }
    const { error } = editandoId
      ? await supabase.from('camion_costos').update(payload).eq('id', editandoId)
      : await supabase.from('camion_costos').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setEditandoId(null); setForm({ ...vacio, fecha: hoy() })
    cargar()
  }

  function editar(c: CostoCamion) {
    setEditandoId(c.id)
    setForm({
      fecha: c.fecha, categoria: c.categoria, descripcion: c.descripcion ?? '',
      litros: c.litros != null ? String(c.litros) : '', monto_usd: String(c.monto_usd),
      proveedor: c.proveedor ?? '', comprobante: c.comprobante ?? '', observaciones: c.observaciones ?? '',
    })
    setError(null); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function borrar(id: number) {
    if (!confirm('¿Borrar este costo?')) return
    const { error } = await supabase.from('camion_costos').delete().eq('id', id)
    if (error) alert(error.message)
    cargar()
  }

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Costos del camión</h1>
          <p className="text-campo-500 text-sm mt-0.5">Combustible, repuestos, mantenimiento y demás gastos, cargados en USD tal como se van pagando</p>
        </div>
        <button onClick={() => { setEditandoId(null); setForm({ ...vacio, fecha: hoy() }); setError(null); setShowForm(true) }}
          className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nuevo costo
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar costo' : 'Nuevo costo'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Categoría *</label>
              <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className={inp}>
                {CATEGORIAS_COSTO.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Monto (USD) *</label>
              <input type="number" step="0.01" min="0" value={form.monto_usd} onChange={e => setForm(f => ({ ...f, monto_usd: e.target.value }))} className={inp} />
            </div>
            {form.categoria === 'combustible' && (
              <div>
                <label className={lbl}>Litros</label>
                <input type="number" step="0.01" min="0" value={form.litros} onChange={e => setForm(f => ({ ...f, litros: e.target.value }))} className={inp} />
                {n(form.litros) > 0 && n(form.monto_usd) > 0 && (
                  <p className="text-xs text-campo-500 mt-1">Precio: USD {(n(form.monto_usd) / n(form.litros)).toFixed(3)}/L</p>
                )}
              </div>
            )}
            <div className="lg:col-span-2">
              <label className={lbl}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: cambio de embrague, carga de gasoil…" className={inp} />
            </div>
            <div>
              <label className={lbl}>Proveedor</label>
              <input value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Comprobante</label>
              <input value={form.comprobante} onChange={e => setForm(f => ({ ...f, comprobante: e.target.value }))} placeholder="Factura / remito" className={inp} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={lbl}>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inp} />
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar costo'}
            </button>
            <button onClick={() => { setShowForm(false); setEditandoId(null) }} className="text-sm text-campo-500 px-4 py-2 rounded-lg hover:bg-campo-100">Cancelar</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm">
          <option value="">Todas las categorías</option>
          {CATEGORIAS_COSTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm" title="Desde" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm" title="Hasta" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar…" className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm w-56" />
        {(filtroCat || desde || hasta || busqueda) && (
          <button onClick={() => { setFiltroCat(''); setDesde(''); setHasta(''); setBusqueda('') }} className="text-xs text-campo-500 underline">Limpiar</button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total costos</div>
          <div className="text-lg font-bold text-campo-900">{fmtUsd(total)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">⛽ Combustible</div>
          <div className="text-lg font-bold text-campo-900">{fmtUsd(usdCombustible)}</div>
          <div className="text-xs text-campo-400">{fmtNum(litros, 0)} L{litros > 0 ? ` · USD ${(usdCombustible / litros).toFixed(3)}/L` : ''}</div>
        </div>
        {CATEGORIAS_COSTO.filter(c => c.value !== 'combustible' && porCategoria[c.value]).slice(0, 2).map(c => (
          <div key={c.value} className="card p-4">
            <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">{c.icon} {c.label}</div>
            <div className="text-lg font-bold text-campo-900">{fmtUsd(porCategoria[c.value])}</div>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Categoría</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-left">Proveedor</th>
                <th className="px-3 py-2 text-left">Comprobante</th>
                <th className="px-3 py-2 text-right">Litros</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {loading && <tr><td colSpan={8} className="px-3 py-10 text-center text-campo-400">Cargando…</td></tr>}
              {!loading && filtrados.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-campo-400">Todavía no hay costos cargados</td></tr>}
              {filtrados.map(c => (
                <tr key={c.id} className="hover:bg-campo-50/60">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{etiquetaCategoria(c.categoria)}</td>
                  <td className="px-3 py-2">{c.descripcion ?? '—'}</td>
                  <td className="px-3 py-2">{c.proveedor ?? '—'}</td>
                  <td className="px-3 py-2">{c.comprobante ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{c.litros != null ? fmtNum(c.litros, 0) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtUsd(c.monto_usd)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => editar(c)} className="text-xs text-amber-700 hover:underline mr-3">Editar</button>
                    <button onClick={() => borrar(c.id)} className="text-xs text-red-600 hover:underline">Borrar</button>
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
