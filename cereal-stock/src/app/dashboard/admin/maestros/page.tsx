'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'cultivos' | 'lotes' | 'clientes' | 'acopios'

export default function MaestrosPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('cultivos')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Formularios por tab
  const [cultivoForm, setCultivoForm] = useState({ nombre: '', codigo: '' })
  const [loteForm, setLoteForm] = useState({ nombre: '', establecimiento: '', hectareas: '', provincia: '', partido: '', localidad: '' })
  const [clienteForm, setClienteForm] = useState({ razon_social: '', cuit: '', tipo: 'exportador', contacto: '', email: '', telefono: '', localidad: '', provincia: '' })
  const [acopioForm, setAcopioForm] = useState({ nombre: '', razon_social: '', cuit: '', localidad: '', provincia: '', capacidad_ton: '' })

  useEffect(() => { loadData() }, [tab])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from(tab).select('*').order('nombre' in ['cultivos', 'lotes', 'acopios'] ? 'nombre' : 'razon_social')
    setData(data ?? [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    let payload: any = {}
    if (tab === 'cultivos') payload = cultivoForm
    if (tab === 'lotes') payload = { ...loteForm, hectareas: loteForm.hectareas ? parseFloat(loteForm.hectareas) : null }
    if (tab === 'clientes') payload = clienteForm
    if (tab === 'acopios') payload = { ...acopioForm, capacidad_ton: acopioForm.capacidad_ton ? parseFloat(acopioForm.capacidad_ton) : null }

    const { error } = await supabase.from(tab).insert(payload)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Guardado correctamente')
      setShowForm(false)
      loadData()
      // Reset forms
      setCultivoForm({ nombre: '', codigo: '' })
      setLoteForm({ nombre: '', establecimiento: '', hectareas: '', provincia: '', partido: '', localidad: '' })
      setClienteForm({ razon_social: '', cuit: '', tipo: 'exportador', contacto: '', email: '', telefono: '', localidad: '', provincia: '' })
      setAcopioForm({ nombre: '', razon_social: '', cuit: '', localidad: '', provincia: '', capacidad_ton: '' })
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'cultivos', label: 'Cultivos', icon: '🌱' },
    { key: 'lotes', label: 'Lotes / Campos', icon: '🗺️' },
    { key: 'clientes', label: 'Clientes', icon: '🤝' },
    { key: 'acopios', label: 'Acopios', icon: '🏭' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Datos Maestros</h1>
          <p className="text-campo-500 text-sm mt-0.5">Administrá cultivos, lotes, clientes y acopios</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null) }} className="btn-primary">
          {showForm ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setShowForm(false) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-campo-600 text-white' : 'bg-white text-campo-600 border border-campo-200 hover:bg-campo-50'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {success && <div className="rounded-lg bg-campo-100 border border-campo-300 px-4 py-3 text-campo-700 text-sm">✅ {success}</div>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">❌ {error}</div>}

      {/* Formulario */}
      {showForm && (
        <div className="card">
          <h2 className="font-semibold text-campo-800 mb-4">Nuevo {tabs.find(t => t.key === tab)?.label.slice(0, -1)}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'cultivos' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Nombre *</label>
                  <input value={cultivoForm.nombre} onChange={e => setCultivoForm(f => ({ ...f, nombre: e.target.value }))} required placeholder="Soja 3" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Código *</label>
                  <input value={cultivoForm.codigo} onChange={e => setCultivoForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} required placeholder="SOJ3" maxLength={6} className="input-field" />
                </div>
              </div>
            )}

            {tab === 'lotes' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Nombre del lote *</label>
                  <input value={loteForm.nombre} onChange={e => setLoteForm(f => ({ ...f, nombre: e.target.value }))} required placeholder="Lote 1" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Establecimiento *</label>
                  <input value={loteForm.establecimiento} onChange={e => setLoteForm(f => ({ ...f, establecimiento: e.target.value }))} required placeholder="La Esperanza" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Hectáreas</label>
                  <input type="number" step="0.01" value={loteForm.hectareas} onChange={e => setLoteForm(f => ({ ...f, hectareas: e.target.value }))} placeholder="150.00" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Provincia</label>
                  <input value={loteForm.provincia} onChange={e => setLoteForm(f => ({ ...f, provincia: e.target.value }))} placeholder="Buenos Aires" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Partido</label>
                  <input value={loteForm.partido} onChange={e => setLoteForm(f => ({ ...f, partido: e.target.value }))} placeholder="Coronel Suárez" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Localidad</label>
                  <input value={loteForm.localidad} onChange={e => setLoteForm(f => ({ ...f, localidad: e.target.value }))} placeholder="Huanguelen" className="input-field" />
                </div>
              </div>
            )}

            {tab === 'clientes' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-campo-700 mb-1">Razón social *</label>
                  <input value={clienteForm.razon_social} onChange={e => setClienteForm(f => ({ ...f, razon_social: e.target.value }))} required placeholder="Bunge Argentina S.A." className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">CUIT</label>
                  <input value={clienteForm.cuit} onChange={e => setClienteForm(f => ({ ...f, cuit: e.target.value }))} placeholder="30-12345678-9" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Tipo</label>
                  <select value={clienteForm.tipo} onChange={e => setClienteForm(f => ({ ...f, tipo: e.target.value }))} className="input-field">
                    <option value="exportador">Exportador</option>
                    <option value="acopio">Acopio</option>
                    <option value="industria">Industria</option>
                    <option value="particular">Particular</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Email</label>
                  <input type="email" value={clienteForm.email} onChange={e => setClienteForm(f => ({ ...f, email: e.target.value }))} placeholder="contacto@empresa.com" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Teléfono</label>
                  <input value={clienteForm.telefono} onChange={e => setClienteForm(f => ({ ...f, telefono: e.target.value }))} placeholder="+54 11 1234-5678" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Localidad</label>
                  <input value={clienteForm.localidad} onChange={e => setClienteForm(f => ({ ...f, localidad: e.target.value }))} placeholder="Rosario" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Provincia</label>
                  <input value={clienteForm.provincia} onChange={e => setClienteForm(f => ({ ...f, provincia: e.target.value }))} placeholder="Santa Fe" className="input-field" />
                </div>
              </div>
            )}

            {tab === 'acopios' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Nombre *</label>
                  <input value={acopioForm.nombre} onChange={e => setAcopioForm(f => ({ ...f, nombre: e.target.value }))} required placeholder="Acopio San Martín" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Razón social</label>
                  <input value={acopioForm.razon_social} onChange={e => setAcopioForm(f => ({ ...f, razon_social: e.target.value }))} placeholder="San Martín S.A." className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">CUIT</label>
                  <input value={acopioForm.cuit} onChange={e => setAcopioForm(f => ({ ...f, cuit: e.target.value }))} placeholder="30-12345678-9" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Capacidad (tn)</label>
                  <input type="number" step="0.01" value={acopioForm.capacidad_ton} onChange={e => setAcopioForm(f => ({ ...f, capacidad_ton: e.target.value }))} placeholder="5000" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Localidad *</label>
                  <input value={acopioForm.localidad} onChange={e => setAcopioForm(f => ({ ...f, localidad: e.target.value }))} required placeholder="Bahía Blanca" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-campo-700 mb-1">Provincia *</label>
                  <input value={acopioForm.provincia} onChange={e => setAcopioForm(f => ({ ...f, provincia: e.target.value }))} required placeholder="Buenos Aires" className="input-field" />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary px-8">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de datos */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                {tab === 'cultivos' && <>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Nombre</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Código</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Estado</th>
                </>}
                {tab === 'lotes' && <>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Establecimiento</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Hectáreas</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Partido</th>
                </>}
                {tab === 'clientes' && <>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Razón social</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">CUIT</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Localidad</th>
                </>}
                {tab === 'acopios' && <>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Nombre</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Localidad</th>
                  <th className="text-left px-5 py-3 font-semibold text-campo-700">Provincia</th>
                  <th className="text-right px-5 py-3 font-semibold text-campo-700">Capacidad</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-campo-400">Cargando...</td></tr>
              )}
              {!loading && data.map(row => (
                <tr key={row.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                  {tab === 'cultivos' && <>
                    <td className="px-5 py-3 font-medium text-campo-900">{row.nombre}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs bg-campo-100 text-campo-700 px-2 py-0.5 rounded">{row.codigo}</span></td>
                    <td className="px-5 py-3"><span className={row.activo ? 'badge-verde' : 'badge-gris'}>{row.activo ? 'Activo' : 'Inactivo'}</span></td>
                  </>}
                  {tab === 'lotes' && <>
                    <td className="px-5 py-3 font-medium text-campo-900">{row.nombre}</td>
                    <td className="px-5 py-3 text-campo-700">{row.establecimiento}</td>
                    <td className="px-5 py-3 text-right text-campo-600">{row.hectareas ? `${Number(row.hectareas).toLocaleString('es-AR')} ha` : '—'}</td>
                    <td className="px-5 py-3 text-campo-500">{row.partido ?? '—'}</td>
                  </>}
                  {tab === 'clientes' && <>
                    <td className="px-5 py-3 font-medium text-campo-900">{row.razon_social}</td>
                    <td className="px-5 py-3 font-mono text-xs text-campo-600">{row.cuit ?? '—'}</td>
                    <td className="px-5 py-3"><span className="badge-gris capitalize">{row.tipo}</span></td>
                    <td className="px-5 py-3 text-campo-500">{row.localidad ?? '—'}</td>
                  </>}
                  {tab === 'acopios' && <>
                    <td className="px-5 py-3 font-medium text-campo-900">{row.nombre}</td>
                    <td className="px-5 py-3 text-campo-700">{row.localidad}</td>
                    <td className="px-5 py-3 text-campo-500">{row.provincia}</td>
                    <td className="px-5 py-3 text-right text-campo-600">{row.capacidad_ton ? `${Number(row.capacidad_ton).toLocaleString('es-AR')} tn` : '—'}</td>
                  </>}
                </tr>
              ))}
              {!loading && data.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-campo-400">No hay datos. Agregá el primero con el botón +</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
