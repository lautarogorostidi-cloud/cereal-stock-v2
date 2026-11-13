'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { ViajeCamion, fmtUsd, fmtNum, fmtFecha, hoy, n } from '@/lib/camion'

type Cliente = { id: number; nombre: string }
type Vista = 'todos' | 'propio' | 'tercero'

const vacio = {
  fecha: hoy(),
  cliente_id: '',
  carga: '',
  origen: '',
  destino: '',
  chofer: '',
  patente: 'AF456OU',
  toneladas: '',
  km: '',
  tarifa_usd_tn: '',
  numero_cpe: '',
  ctg: '',
  observaciones: '',
}

export default function ViajesCamionPage() {
  const supabase = createClient()
  const [viajes, setViajes] = useState<ViajeCamion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(vacio)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nuevoCliMode, setNuevoCliMode] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', cuit: '', telefono: '' })
  const [editTarifa, setEditTarifa] = useState<{ key: string; valor: string } | null>(null)
  const [errorTarifa, setErrorTarifa] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const [{ data: v }, { data: c }] = await Promise.all([
      fetchAllRows<ViajeCamion>(() => supabase.from('vw_camion_viajes').select('*').order('fecha', { ascending: false }).order('viaje_id', { ascending: false })),
      supabase.from('camion_clientes').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setViajes(v ?? [])
    setClientes(c ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const conteos = useMemo(() => ({
    todos: viajes.length,
    propio: viajes.filter(v => v.origen_viaje === 'propio').length,
    tercero: viajes.filter(v => v.origen_viaje === 'tercero').length,
  }), [viajes])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return viajes.filter(v => {
      if (vista !== 'todos' && v.origen_viaje !== vista) return false
      if (desde && v.fecha < desde) return false
      if (hasta && v.fecha > hasta) return false
      if (!q) return true
      return [v.cliente, v.carga, v.origen, v.destino, v.chofer, v.patente, v.numero_cpe, v.ctg, v.contrato]
        .some(x => (x ?? '').toLowerCase().includes(q))
    })
  }, [viajes, vista, busqueda, desde, hasta])

  const tot = useMemo(() => ({
    viajes: filtrados.length,
    tn: filtrados.reduce((a, v) => a + n(v.tn), 0),
    ingreso: filtrados.reduce((a, v) => a + n(v.ingreso_usd), 0),
    chofer: filtrados.reduce((a, v) => a + n(v.costo_chofer_usd), 0),
    resultado: filtrados.reduce((a, v) => a + n(v.resultado_usd), 0),
  }), [filtrados])

  const sinTarifaChofer = useMemo(() => viajes.filter(v => v.tarifa_chofer_usd_tn === null).length, [viajes])
  const sinTarifaFlete = useMemo(() => viajes.filter(v => n(v.tarifa_usd_tn) === 0).length, [viajes])

  const monto = n(form.toneladas) * n(form.tarifa_usd_tn)

  function nuevo() {
    setEditandoId(null)
    setForm({ ...vacio, fecha: hoy() })
    setError(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarCliente() {
    if (!nuevoCli.nombre.trim()) return
    const { data, error } = await supabase.from('camion_clientes').insert({
      nombre: nuevoCli.nombre.trim(), cuit: nuevoCli.cuit || null, telefono: nuevoCli.telefono || null,
    }).select('id, nombre').single()
    if (error) { setError(error.message); return }
    await cargar()
    setForm(f => ({ ...f, cliente_id: String(data!.id) }))
    setNuevoCliMode(false)
    setNuevoCli({ nombre: '', cuit: '', telefono: '' })
  }

  async function guardar() {
    setError(null)
    if (nuevoCliMode) { setError('Primero guardá o cancelá el alta del cliente.'); return }
    if (!form.fecha || !form.cliente_id || !form.toneladas || form.tarifa_usd_tn === '') {
      setError('Completá fecha, cliente, toneladas y tarifa (USD/tn).'); return
    }
    setSaving(true)
    const payload = {
      fecha: form.fecha,
      cliente_id: Number(form.cliente_id),
      carga: form.carga || null,
      origen: form.origen || null,
      destino: form.destino || null,
      chofer: form.chofer || null,
      patente: form.patente || null,
      toneladas: Number(form.toneladas),
      km: form.km ? Number(form.km) : null,
      tarifa_usd_tn: Number(form.tarifa_usd_tn),
      numero_cpe: form.numero_cpe || null,
      ctg: form.ctg || null,
      observaciones: form.observaciones || null,
    }
    const { error } = editandoId
      ? await supabase.from('camion_viajes_terceros').update(payload).eq('id', Number(editandoId))
      : await supabase.from('camion_viajes_terceros').insert(payload)
    setSaving(false)
    if (error) { setError(error.message); return }
    setShowForm(false); setEditandoId(null); setForm({ ...vacio, fecha: hoy() })
    cargar()
  }

  function editar(v: ViajeCamion) {
    setEditandoId(v.viaje_id)
    setForm({
      fecha: v.fecha,
      cliente_id: v.cliente_id ? String(v.cliente_id) : '',
      carga: v.carga ?? '',
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      chofer: v.chofer ?? '',
      patente: v.patente ?? '',
      toneladas: String(v.tn ?? ''),
      km: v.km != null ? String(v.km) : '',
      tarifa_usd_tn: String(v.tarifa_usd_tn),
      numero_cpe: v.numero_cpe ?? '',
      ctg: v.ctg ?? '',
      observaciones: v.observaciones ?? '',
    })
    setError(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardarTarifaChofer(v: ViajeCamion) {
    if (!editTarifa) return
    setErrorTarifa(null)
    const txt = editTarifa.valor.trim()
    if (txt === '') {
      // vacío = vuelve a la tarifa por defecto (vigencia)
      const { error } = await supabase.from('camion_tarifa_chofer_viaje').delete().eq('origen_viaje', v.origen_viaje).eq('viaje_id', v.viaje_id)
      if (error) { setErrorTarifa(error.message); return }
    } else {
      const valor = Number(txt.replace(',', '.'))
      if (!isFinite(valor) || valor < 0) { setErrorTarifa('La tarifa del chofer tiene que ser un número mayor o igual a 0.'); return }
      const { error } = await supabase.from('camion_tarifa_chofer_viaje').upsert(
        { origen_viaje: v.origen_viaje, viaje_id: v.viaje_id, usd_por_tn: valor, updated_at: new Date().toISOString() },
        { onConflict: 'origen_viaje,viaje_id' }
      )
      if (error) { setErrorTarifa(error.message); return }
    }
    setEditTarifa(null)
    cargar()
  }

  async function borrar(v: ViajeCamion) {
    if (!confirm('¿Borrar este viaje de tercero?')) return
    const { error } = await supabase.from('camion_viajes_terceros').delete().eq('id', Number(v.viaje_id))
    if (error) alert(error.message)
    else await supabase.from('camion_tarifa_chofer_viaje').delete().eq('origen_viaje', 'tercero').eq('viaje_id', v.viaje_id)
    cargar()
  }

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Viajes</h1>
          <p className="text-campo-500 text-sm mt-0.5">
            Trazabilidad de cada viaje del camión: los propios salen de las cartas de porte, los de terceros se cargan acá
          </p>
        </div>
        <button onClick={nuevo} className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Viaje de tercero
        </button>
      </div>

      {(sinTarifaChofer > 0 || sinTarifaFlete > 0) && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
          {sinTarifaFlete > 0 && <div>⚠️ {sinTarifaFlete} viaje(s) sin tarifa de flete: figuran con ingreso USD 0. Cargala en la carta de porte.</div>}
          {sinTarifaChofer > 0 && (
            <div>
              ⚠️ {sinTarifaChofer} viaje(s) sin tarifa de chofer: el costo figura en 0. Cargala en la columna “Chofer USD/tn” de cada viaje.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar viaje de tercero' : 'Nuevo viaje de tercero'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} className={inp} />
            </div>
            <div className="lg:col-span-2">
              <label className={lbl}>Cliente *</label>
              {!nuevoCliMode ? (
                <select value={form.cliente_id} onChange={e => {
                  if (e.target.value === '__nuevo__') { setNuevoCliMode(true); return }
                  setForm(f => ({ ...f, cliente_id: e.target.value }))
                }} className={inp}>
                  <option value="">Seleccioná un cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  <option value="__nuevo__">➕ Agregar nuevo cliente...</option>
                </select>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <div className="text-xs font-medium text-amber-800">Nuevo cliente</div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={nuevoCli.nombre} onChange={e => setNuevoCli(c => ({ ...c, nombre: e.target.value }))} placeholder="Nombre *" className={inp} />
                    <input value={nuevoCli.cuit} onChange={e => setNuevoCli(c => ({ ...c, cuit: e.target.value }))} placeholder="CUIT" className={inp} />
                    <input value={nuevoCli.telefono} onChange={e => setNuevoCli(c => ({ ...c, telefono: e.target.value }))} placeholder="Teléfono" className={inp} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={guardarCliente} disabled={!nuevoCli.nombre.trim()}
                      className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg">Guardar cliente</button>
                    <button type="button" onClick={() => setNuevoCliMode(false)} className="text-xs text-campo-500 px-3 py-1.5 rounded-lg hover:bg-campo-100">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className={lbl}>Carga</label>
              <input value={form.carga} onChange={e => setForm(f => ({ ...f, carga: e.target.value }))} placeholder="Soja, maíz, fertilizante…" className={inp} />
            </div>
            <div className="lg:col-span-2">
              <label className={lbl}>Origen</label>
              <input value={form.origen} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} className={inp} />
            </div>
            <div className="lg:col-span-2">
              <label className={lbl}>Destino</label>
              <input value={form.destino} onChange={e => setForm(f => ({ ...f, destino: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Chofer</label>
              <input value={form.chofer} onChange={e => setForm(f => ({ ...f, chofer: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Patente</label>
              <input value={form.patente} onChange={e => setForm(f => ({ ...f, patente: e.target.value.toUpperCase() }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Toneladas *</label>
              <input type="number" step="0.001" min="0" value={form.toneladas} onChange={e => setForm(f => ({ ...f, toneladas: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Km</label>
              <input type="number" step="0.1" min="0" value={form.km} onChange={e => setForm(f => ({ ...f, km: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Tarifa (USD/tn) *</label>
              <input type="number" step="0.01" min="0" value={form.tarifa_usd_tn} onChange={e => setForm(f => ({ ...f, tarifa_usd_tn: e.target.value }))} className={inp} />
              {monto > 0 && <p className="text-xs text-campo-500 mt-1">Monto del viaje: <b>{fmtUsd(monto)}</b></p>}
            </div>
            <div>
              <label className={lbl}>Carta de porte (CPE)</label>
              <input value={form.numero_cpe} onChange={e => setForm(f => ({ ...f, numero_cpe: e.target.value }))} placeholder="Opcional" className={inp} />
            </div>
            <div>
              <label className={lbl}>CTG</label>
              <input value={form.ctg} onChange={e => setForm(f => ({ ...f, ctg: e.target.value }))} placeholder="Opcional" className={inp} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={lbl}>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inp} />
            </div>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar viaje'}
            </button>
            <button onClick={() => { setShowForm(false); setEditandoId(null); setError(null) }} className="text-sm text-campo-500 px-4 py-2 rounded-lg hover:bg-campo-100">Cancelar</button>
          </div>
        </div>
      )}

      {errorTarifa && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorTarifa}</div>}

      {/* Tabs + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          ['todos', 'Todos'], ['propio', 'Propios (cartas de porte)'], ['tercero', 'Terceros'],
        ] as [Vista, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setVista(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              vista === k ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'
            }`}>
            {label} <span className="opacity-70">({conteos[k]})</span>
          </button>
        ))}
        <div className="flex-1" />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm" title="Desde" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm" title="Hasta" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente, destino, chofer, CPE…"
          className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm w-64" />
        {(desde || hasta || busqueda) && (
          <button onClick={() => { setDesde(''); setHasta(''); setBusqueda('') }} className="text-xs text-campo-500 hover:text-campo-700 underline">Limpiar</button>
        )}
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Viajes', String(tot.viajes)],
          ['Toneladas', fmtNum(tot.tn, 1)],
          ['Ingresos por flete', fmtUsd(tot.ingreso)],
          ['Costo chofer', fmtUsd(tot.chofer)],
          ['Resultado (antes de otros costos)', fmtUsd(tot.resultado)],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">{l}</div>
            <div className="text-lg font-bold text-campo-900">{v}</div>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Carga</th>
                <th className="px-3 py-2 text-left">Origen</th>
                <th className="px-3 py-2 text-left">Destino</th>
                <th className="px-3 py-2 text-left">Chofer</th>
                <th className="px-3 py-2 text-left">Patente</th>
                <th className="px-3 py-2 text-right">Km</th>
                <th className="px-3 py-2 text-right">Tn origen</th>
                <th className="px-3 py-2 text-right">Tn netas</th>
                <th className="px-3 py-2 text-right">Dif.</th>
                <th className="px-3 py-2 text-left">CPE / CTG</th>
                <th className="px-3 py-2 text-right">Flete USD/tn</th>
                <th className="px-3 py-2 text-right">Ingreso</th>
                <th className="px-3 py-2 text-right">Chofer USD/tn</th>
                <th className="px-3 py-2 text-right">Costo chofer</th>
                <th className="px-3 py-2 text-right">Resultado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {loading && <tr><td colSpan={19} className="px-3 py-10 text-center text-campo-400">Cargando…</td></tr>}
              {!loading && filtrados.length === 0 && <tr><td colSpan={19} className="px-3 py-10 text-center text-campo-400">No hay viajes con esos filtros</td></tr>}
              {filtrados.map(v => (
                <tr key={v.origen_viaje + v.viaje_id} className="hover:bg-campo-50/60">
                  <td className="px-3 py-2">{fmtFecha(v.fecha)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${v.origen_viaje === 'propio' ? 'bg-campo-100 text-campo-700' : 'bg-amber-100 text-amber-800'}`}>
                      {v.origen_viaje === 'propio' ? 'Propio' : 'Tercero'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={v.cliente ?? ''}>{v.cliente ?? '—'}</td>
                  <td className="px-3 py-2">{v.carga ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={v.origen ?? ''}>{v.origen ?? '—'}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={v.destino ?? ''}>{v.destino ?? '—'}</td>
                  <td className="px-3 py-2">{v.chofer ?? '—'}</td>
                  <td className="px-3 py-2">{v.patente ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{v.km != null ? fmtNum(v.km, 0) : '—'}</td>
                  <td className="px-3 py-2 text-right">{v.tn_origen != null ? fmtNum(v.tn_origen, 2) : '—'}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtNum(v.tn, 2)}</td>
                  <td className={`px-3 py-2 text-right ${n(v.diferencia_tn) < 0 ? 'text-red-600' : 'text-campo-500'}`}>
                    {v.origen_viaje === 'propio' ? fmtNum(v.diferencia_tn, 2) : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{v.numero_cpe ?? '—'}</div>
                    {v.ctg && <div className="text-campo-400">CTG {v.ctg}</div>}
                  </td>
                  <td className={`px-3 py-2 text-right ${n(v.tarifa_usd_tn) === 0 ? 'text-red-600 font-medium' : ''}`}>{fmtNum(v.tarifa_usd_tn, 2)}</td>
                  <td className="px-3 py-2 text-right">{fmtUsd(v.ingreso_usd)}</td>
                  <td className="px-3 py-2 text-right">
                    {editTarifa?.key === v.origen_viaje + v.viaje_id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input
                          autoFocus
                          type="number" step="0.01" min="0"
                          value={editTarifa.valor}
                          onChange={e => setEditTarifa({ key: editTarifa.key, valor: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') guardarTarifaChofer(v); if (e.key === 'Escape') { setEditTarifa(null); setErrorTarifa(null) } }}
                          className="w-20 rounded border border-campo-300 px-2 py-1 text-sm text-right"
                          placeholder="defecto"
                        />
                        <button onClick={() => guardarTarifaChofer(v)} className="text-xs text-white bg-amber-700 hover:bg-amber-600 rounded px-2 py-1">OK</button>
                        <button onClick={() => { setEditTarifa(null); setErrorTarifa(null) }} className="text-xs text-campo-500 px-1">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setErrorTarifa(null); setEditTarifa({ key: v.origen_viaje + v.viaje_id, valor: v.tarifa_chofer_propia && v.tarifa_chofer_usd_tn != null ? String(v.tarifa_chofer_usd_tn) : '' }) }}
                        title={v.tarifa_chofer_propia ? 'Tarifa propia de este viaje. Click para cambiarla (vacío = volver a la tarifa por defecto)' : v.tarifa_chofer_usd_tn != null ? 'Tarifa por defecto (vigencia). Click para fijar la de este viaje' : 'Sin tarifa. Click para cargarla'}
                        className={`hover:underline ${v.tarifa_chofer_usd_tn == null ? 'text-red-600 font-medium' : v.tarifa_chofer_propia ? 'text-campo-900 font-medium' : 'text-campo-400 italic'}`}
                      >
                        {v.tarifa_chofer_usd_tn != null ? fmtNum(v.tarifa_chofer_usd_tn, 2) : '+ cargar'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-campo-600">{fmtUsd(v.costo_chofer_usd)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-campo-900">{fmtUsd(v.resultado_usd)}</td>
                  <td className="px-3 py-2 text-right">
                    {v.origen_viaje === 'tercero' ? (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => editar(v)} className="text-xs text-amber-700 hover:underline">Editar</button>
                        <button onClick={() => borrar(v)} className="text-xs text-red-600 hover:underline">Borrar</button>
                      </div>
                    ) : (
                      <Link href="/dashboard/cartas-porte" className="text-xs text-campo-500 hover:underline">Ver CPE</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-campo-400">
        Tn netas = toneladas descargadas (propios: de la carta de porte). Ingreso = tn netas × tarifa. Costo chofer = tn netas × tarifa del chofer de ese viaje (en gris cursiva: la tarifa por defecto de “Tarifa del chofer”, porque todavía no le fijaste una propia).
        El combustible y demás costos no se asignan por viaje: se ven en Rentabilidad por período.
      </p>
    </div>
  )
}
