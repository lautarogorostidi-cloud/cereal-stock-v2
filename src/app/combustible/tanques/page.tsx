'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tanque = {
  id: number
  nombre: string
  tipo: string
  combustible: string
  capacidad_litros: number | null
  ubicacion: string | null
  activo: boolean
  observaciones: string | null
}

const TIPOS = ['fijo', 'movil']
const COMBUSTIBLES = ['gasoil', 'nafta', 'gnc', 'otro']

export default function TanquesPage() {
  const supabase = createClient()
  const [tanques, setTanques] = useState<Tanque[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)

  const vacio = {
    nombre: '', tipo: 'fijo', combustible: 'gasoil',
    capacidad_litros: '', ubicacion: '', observaciones: '',
  }
  const [form, setForm] = useState(vacio)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('combustible_tanques').select('*').order('nombre')
    if (error) console.error('Error cargando tanques:', error)
    setTanques(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function handleGuardar() {
    setError(null)
    if (!form.nombre) { setError('Completá el nombre del tanque'); return }
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
      combustible: form.combustible,
      capacidad_litros: form.capacidad_litros ? Number(form.capacidad_litros) : null,
      ubicacion: form.ubicacion || null,
      observaciones: form.observaciones || null,
    }
    const { error } = editandoId
      ? await supabase.from('combustible_tanques').update(payload).eq('id', editandoId)
      : await supabase.from('combustible_tanques').insert({ ...payload, activo: true })
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

  function editar(t: Tanque) {
    setEditandoId(t.id)
    setForm({
      nombre: t.nombre,
      tipo: t.tipo,
      combustible: t.combustible,
      capacidad_litros: t.capacidad_litros?.toString() ?? '',
      ubicacion: t.ubicacion ?? '',
      observaciones: t.observaciones ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleActivo(t: Tanque) {
    await supabase.from('combustible_tanques').update({ activo: !t.activo }).eq('id', t.id)
    cargar()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Tanques</h1>
          <p className="text-campo-500 text-sm mt-0.5">Cisternas y petroleros — {tanques.length} registrados</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditandoId(null); setForm(vacio) }}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nuevo tanque
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar tanque' : 'Nuevo tanque'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Cisterna Don Francisco"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {TIPOS.map(t => <option key={t} value={t}>{t === 'fijo' ? 'Fijo (cisterna)' : 'Móvil (petrolero)'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Combustible</label>
              <select value={form.combustible} onChange={e => setForm(f => ({ ...f, combustible: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {COMBUSTIBLES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Capacidad (litros)</label>
              <input type="number" step="1" min="0" value={form.capacidad_litros}
                onChange={e => setForm(f => ({ ...f, capacidad_litros: e.target.value }))}
                placeholder="10000"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Ubicación</label>
              <input type="text" value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Campo Don Francisco"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-campo-700 mb-1">Observaciones</label>
              <input type="text" value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
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

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Nombre</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Combustible</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Capacidad</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Ubicación</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && tanques.length === 0 && <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay tanques registrados</td></tr>}
              {tanques.map(t => (
                <tr key={t.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{t.nombre}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{t.tipo === 'fijo' ? 'Fijo' : 'Móvil'}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{t.combustible}</td>
                  <td className="px-5 py-3 text-right text-campo-600">{t.capacidad_litros ? `${Number(t.capacidad_litros).toLocaleString('es-AR')} L` : '—'}</td>
                  <td className="px-5 py-3 text-campo-600">{t.ubicacion ?? '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleActivo(t)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-campo-100 text-campo-500'}`}>
                      {t.activo ? '✓ Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => editar(t)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
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
