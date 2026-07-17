'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Maquina = {
  id: number
  nombre: string
  tipo: string
  marca: string | null
  modelo: string | null
  patente_interno: string | null
  activo: boolean
  observaciones: string | null
}

const TIPOS = [
  { value: 'tractor', label: '🚜 Tractor' },
  { value: 'cosechadora', label: '🌾 Cosechadora' },
  { value: 'pulverizadora', label: '💦 Pulverizadora' },
  { value: 'camioneta', label: '🚙 Camioneta' },
  { value: 'camion', label: '🚚 Camión' },
  { value: 'otro', label: '🔧 Otro' },
]

export default function MaquinasPage() {
  const supabase = createClient()
  const [maquinas, setMaquinas] = useState<Maquina[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const vacio = { nombre: '', tipo: 'tractor', marca: '', modelo: '', patente_interno: '', observaciones: '' }
  const [form, setForm] = useState(vacio)

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('combustible_maquinas').select('*').order('tipo').order('nombre')
    if (error) console.error('Error cargando máquinas:', error)
    setMaquinas(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  async function handleGuardar() {
    setError(null)
    if (!form.nombre) { setError('Completá el nombre de la máquina'); return }
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
      marca: form.marca || null,
      modelo: form.modelo || null,
      patente_interno: form.patente_interno || null,
      observaciones: form.observaciones || null,
    }
    const { error } = editandoId
      ? await supabase.from('combustible_maquinas').update(payload).eq('id', editandoId)
      : await supabase.from('combustible_maquinas').insert({ ...payload, activo: true })
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

  function editar(m: Maquina) {
    setEditandoId(m.id)
    setForm({
      nombre: m.nombre,
      tipo: m.tipo,
      marca: m.marca ?? '',
      modelo: m.modelo ?? '',
      patente_interno: m.patente_interno ?? '',
      observaciones: m.observaciones ?? '',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function toggleActivo(m: Maquina) {
    await supabase.from('combustible_maquinas').update({ activo: !m.activo }).eq('id', m.id)
    cargar()
  }

  const iconoTipo = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label.split(' ')[0] ?? '🔧'
  const nombreTipo = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label.split(' ').slice(1).join(' ') ?? tipo

  const filtradas = maquinas.filter(m => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return m.nombre.toLowerCase().includes(q) || m.marca?.toLowerCase().includes(q) || m.patente_interno?.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Maquinaria</h1>
          <p className="text-campo-500 text-sm mt-0.5">Máquinas y vehículos del campo — {maquinas.length} registrados</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditandoId(null); setForm(vacio) }}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Nueva máquina
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar máquina' : 'Nueva máquina'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Tractor John Deere 6130"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Marca</label>
              <input type="text" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))}
                placeholder="John Deere"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Modelo</label>
              <input type="text" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))}
                placeholder="6130J"
                className="w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-campo-700 mb-1">Patente / N° interno</label>
              <input type="text" value={form.patente_interno} onChange={e => setForm(f => ({ ...f, patente_interno: e.target.value }))}
                placeholder="AF456OU / Interno 12"
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

      <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, marca o patente..."
        className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Máquina</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Marca / Modelo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Patente / Interno</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Estado</th>
                <th className="text-center px-5 py-3 font-semibold text-campo-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && filtradas.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-campo-400">No hay máquinas registradas</td></tr>}
              {filtradas.map(m => (
                <tr key={m.id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{iconoTipo(m.tipo)} {m.nombre}</td>
                  <td className="px-5 py-3 text-campo-600">{nombreTipo(m.tipo)}</td>
                  <td className="px-5 py-3 text-campo-600">{[m.marca, m.modelo].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-5 py-3 text-campo-600">{m.patente_interno ?? '—'}</td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleActivo(m)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${m.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-campo-100 text-campo-500'}`}>
                      {m.activo ? '✓ Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => editar(m)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
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
