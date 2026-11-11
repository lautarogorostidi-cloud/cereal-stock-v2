'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtFecha, fmtNum, hoy } from '@/lib/camion'

type Tarifa = { id: number; vigente_desde: string; usd_por_tn: number; observaciones: string | null }

export default function TarifaChoferPage() {
  const supabase = createClient()
  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ vigente_desde: hoy(), usd_por_tn: '', observaciones: '' })
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('camion_tarifas_chofer').select('*').order('vigente_desde', { ascending: false })
    setTarifas(data ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  async function guardar() {
    setError(null)
    if (!form.vigente_desde || form.usd_por_tn === '') { setError('Completá la fecha y el valor en USD por tonelada.'); return }
    setSaving(true)
    const payload = { vigente_desde: form.vigente_desde, usd_por_tn: Number(form.usd_por_tn), observaciones: form.observaciones || null }
    const { error } = editandoId
      ? await supabase.from('camion_tarifas_chofer').update(payload).eq('id', editandoId)
      : await supabase.from('camion_tarifas_chofer').insert(payload)
    setSaving(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'Ya existe una tarifa con esa fecha de vigencia. Editá esa o usá otra fecha.' : error.message)
      return
    }
    setEditandoId(null)
    setForm({ vigente_desde: hoy(), usd_por_tn: '', observaciones: '' })
    cargar()
  }

  function editar(t: Tarifa) {
    setEditandoId(t.id)
    setForm({ vigente_desde: t.vigente_desde, usd_por_tn: String(t.usd_por_tn), observaciones: t.observaciones ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function borrar(id: number) {
    if (!confirm('¿Borrar esta tarifa? Los viajes que la usaban pasan a la tarifa anterior (o a costo 0 si no hay).')) return
    const { error } = await supabase.from('camion_tarifas_chofer').delete().eq('id', id)
    if (error) alert(error.message)
    cargar()
  }

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Tarifa del chofer</h1>
        <p className="text-campo-500 text-sm mt-0.5">
          Lo que cobra el chofer por tonelada transportada (USD/tn). Es un costo del negocio, aparte de la tarifa de flete que cobrás vos.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-campo-900">{editandoId ? 'Editar tarifa' : 'Nueva tarifa'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Vigente desde *</label>
            <input type="date" value={form.vigente_desde} onChange={e => setForm(f => ({ ...f, vigente_desde: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>USD por tonelada *</label>
            <input type="number" step="0.01" min="0" value={form.usd_por_tn} onChange={e => setForm(f => ({ ...f, usd_por_tn: e.target.value }))} className={inp} />
          </div>
          <div>
            <label className={lbl}>Observaciones</label>
            <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inp} />
          </div>
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2">
          <button onClick={guardar} disabled={saving} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {saving ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar tarifa'}
          </button>
          {editandoId && (
            <button onClick={() => { setEditandoId(null); setForm({ vigente_desde: hoy(), usd_por_tn: '', observaciones: '' }) }} className="text-sm text-campo-500 px-4 py-2 rounded-lg hover:bg-campo-100">Cancelar</button>
          )}
        </div>
        <p className="text-xs text-campo-400">
          Cada viaje usa la tarifa vigente a su fecha (la más reciente con “vigente desde” igual o anterior). Para que aplique a viajes ya hechos, cargá una vigencia con una fecha anterior al primer viaje (ej. 01/01/2026).
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 text-left">Vigente desde</th>
              <th className="px-4 py-2 text-right">USD / tn</th>
              <th className="px-4 py-2 text-left">Observaciones</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-campo-50">
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-campo-400">Cargando…</td></tr>}
            {!loading && tarifas.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-campo-400">Todavía no cargaste ninguna tarifa de chofer</td></tr>}
            {tarifas.map((t, i) => (
              <tr key={t.id}>
                <td className="px-4 py-2">{fmtFecha(t.vigente_desde)} {i === 0 && <span className="ml-1 text-xs bg-campo-100 text-campo-700 px-2 py-0.5 rounded-full">vigente</span>}</td>
                <td className="px-4 py-2 text-right font-semibold">{fmtNum(t.usd_por_tn, 2)}</td>
                <td className="px-4 py-2">{t.observaciones ?? '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => editar(t)} className="text-xs text-amber-700 hover:underline mr-3">Editar</button>
                  <button onClick={() => borrar(t.id)} className="text-xs text-red-600 hover:underline">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
