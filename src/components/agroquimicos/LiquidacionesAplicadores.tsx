'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

type Apl = { id: number; proveedor: string | null; fecha: string | null; superficie_ha: number | null; costo_servicio_usd_ha: number | null }

type Liq = {
  id: number
  proveedor: string
  fecha_desde: string
  fecha_hasta: string
  ha_facturadas: number | null
  usd_ha: number
  pagado: boolean
  fecha_pago: string | null
  observaciones: string | null
}

const FORM_VACIO = {
  proveedor: '', fecha_desde: '', fecha_hasta: '', ha_facturadas: '', usd_ha: '',
  pagado: false, fecha_pago: '', observaciones: '',
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()
const hoyISO = () => new Date().toLocaleDateString('en-CA')
const redondear = (n: number, dec: number) => Number(n.toFixed(dec))

export default function LiquidacionesAplicadores() {
  const supabase = createClient()
  const [apls, setApls] = useState<Apl[]>([])
  const [liqs, setLiqs] = useState<Liq[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [tocoHa, setTocoHa] = useState(false)
  const [tocoUsd, setTocoUsd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: a }, { data: l, error: errL }] = await Promise.all([
      fetchAllRows<Apl>(() => supabase.from('sa_aplicaciones').select('id, proveedor, fecha, superficie_ha, costo_servicio_usd_ha').not('proveedor', 'is', null).order('id')),
      supabase.from('sa_liquidaciones_aplicador').select('*').order('fecha_hasta', { ascending: false }).order('id', { ascending: false }),
    ])
    if (errL) console.error('Error cargando liquidaciones:', errL)
    setApls(a ?? [])
    setLiqs((l ?? []) as Liq[])
    setLoading(false)
  }

  const aplicadores = useMemo(() => {
    const m = new Map<string, string>()
    apls.forEach(a => { const k = norm(a.proveedor); if (k && !m.has(k)) m.set(k, (a.proveedor ?? '').trim()) })
    return Array.from(m.values()).sort((x, y) => x.localeCompare(y))
  }, [apls])

  // Ha y costo promedio ponderado de las aplicaciones de un aplicador en un rango (todas las campañas)
  function calcular(proveedor: string, desde: string, hasta: string) {
    if (!proveedor || !desde || !hasta) return { ha: 0, usdHa: 0, n: 0 }
    const k = norm(proveedor)
    let ha = 0, costo = 0, n = 0
    apls.forEach(a => {
      if (norm(a.proveedor) !== k || !a.fecha || a.fecha < desde || a.fecha > hasta) return
      const s = Number(a.superficie_ha ?? 0)
      ha += s
      costo += s * Number(a.costo_servicio_usd_ha ?? 0)
      n += 1
    })
    return { ha, usdHa: ha > 0 ? costo / ha : 0, n }
  }

  const calcForm = useMemo(() => calcular(form.proveedor, form.fecha_desde, form.fecha_hasta), [apls, form.proveedor, form.fecha_desde, form.fecha_hasta])

  // Al elegir aplicador y fechas, se proponen las ha y el USD/ha calculados (se pueden pisar)
  useEffect(() => {
    if (!showForm) return
    setForm(f => ({
      ...f,
      ha_facturadas: !tocoHa && calcForm.n > 0 ? String(redondear(calcForm.ha, 2)) : f.ha_facturadas,
      usd_ha: !tocoUsd && calcForm.n > 0 ? String(redondear(calcForm.usdHa, 4)) : f.usd_ha,
    }))
  }, [calcForm.ha, calcForm.usdHa, calcForm.n, showForm])

  function nueva() {
    setEditandoId(null); setForm(FORM_VACIO); setTocoHa(false); setTocoUsd(false); setError(null); setShowForm(true)
  }

  function editar(l: Liq) {
    setEditandoId(l.id); setTocoHa(true); setTocoUsd(true); setError(null); setShowForm(true)
    setForm({
      proveedor: l.proveedor, fecha_desde: l.fecha_desde, fecha_hasta: l.fecha_hasta,
      ha_facturadas: l.ha_facturadas != null ? String(l.ha_facturadas) : '', usd_ha: String(l.usd_ha),
      pagado: l.pagado, fecha_pago: l.fecha_pago ?? '', observaciones: l.observaciones ?? '',
    })
  }

  function cerrarForm() { setShowForm(false); setEditandoId(null); setForm(FORM_VACIO); setError(null) }

  // Otra liquidación del mismo aplicador que se pisa con estas fechas (para no pagar dos veces)
  const solapadas = useMemo(() => {
    if (!form.proveedor || !form.fecha_desde || !form.fecha_hasta) return []
    return liqs.filter(l => l.id !== editandoId && norm(l.proveedor) === norm(form.proveedor)
      && l.fecha_desde <= form.fecha_hasta && l.fecha_hasta >= form.fecha_desde)
  }, [liqs, form.proveedor, form.fecha_desde, form.fecha_hasta, editandoId])

  async function guardar() {
    setError(null)
    if (!form.proveedor.trim()) { setError('Elegí el aplicador.'); return }
    if (!form.fecha_desde || !form.fecha_hasta) { setError('Completá el rango de fechas (desde y hasta).'); return }
    if (form.fecha_hasta < form.fecha_desde) { setError('La fecha "hasta" no puede ser anterior a "desde".'); return }
    if (form.usd_ha === '' || Number(form.usd_ha) < 0) { setError('Cargá el costo en USD por hectárea.'); return }
    if (form.pagado && !form.fecha_pago) { setError('Si está pagado, indicá la fecha de pago.'); return }
    setSaving(true)
    const payload = {
      proveedor: form.proveedor.trim(),
      fecha_desde: form.fecha_desde,
      fecha_hasta: form.fecha_hasta,
      ha_facturadas: form.ha_facturadas !== '' ? Number(form.ha_facturadas) : null,
      usd_ha: Number(form.usd_ha),
      pagado: form.pagado,
      fecha_pago: form.pagado ? form.fecha_pago : null,
      observaciones: form.observaciones.trim() || null,
    }
    const { error: err } = editandoId
      ? await supabase.from('sa_liquidaciones_aplicador').update(payload).eq('id', editandoId)
      : await supabase.from('sa_liquidaciones_aplicador').insert(payload)
    setSaving(false)
    if (err) { setError(`Error: ${err.message}`); return }
    cerrarForm()
    cargar()
  }

  async function marcarPagado(l: Liq) {
    await supabase.from('sa_liquidaciones_aplicador').update({ pagado: true, fecha_pago: hoyISO() }).eq('id', l.id)
    cargar()
  }

  async function desmarcarPagado(l: Liq) {
    if (!confirm('¿Volver esta liquidación a pendiente de pago?')) return
    await supabase.from('sa_liquidaciones_aplicador').update({ pagado: false, fecha_pago: null }).eq('id', l.id)
    cargar()
  }

  async function borrar(l: Liq) {
    if (!confirm(`¿Borrar la liquidación de ${l.proveedor}?`)) return
    await supabase.from('sa_liquidaciones_aplicador').delete().eq('id', l.id)
    cargar()
  }

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const fmtUsdHa = (n: number) => `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtFecha = (s: string | null) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

  const filas = liqs.map(l => {
    const sis = calcular(l.proveedor, l.fecha_desde, l.fecha_hasta)
    const ha = l.ha_facturadas != null ? Number(l.ha_facturadas) : sis.ha
    return { l, haSistema: sis.ha, haFact: l.ha_facturadas != null ? Number(l.ha_facturadas) : null, dif: l.ha_facturadas != null ? Number(l.ha_facturadas) - sis.ha : null, monto: ha * Number(l.usd_ha) }
  })
  const totalPendiente = filas.filter(f => !f.l.pagado).reduce((a, f) => a + f.monto, 0)
  const totalPagado = filas.filter(f => f.l.pagado).reduce((a, f) => a + f.monto, 0)

  const montoForm = (form.ha_facturadas !== '' ? Number(form.ha_facturadas) : calcForm.ha) * Number(form.usd_ha || 0)
  const difForm = form.ha_facturadas !== '' && calcForm.n > 0 ? Number(form.ha_facturadas) - calcForm.ha : null

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-3 border-b border-campo-100 bg-campo-50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-campo-700 text-sm">Liquidaciones a aplicadores</h2>
          <p className="text-xs text-campo-500">Registrá el período de cada aplicador, las hectáreas que facturó y si ya le pagaste</p>
        </div>
        {!showForm && (
          <button onClick={nueva} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Nueva liquidación</button>
        )}
      </div>

      {showForm && (
        <div className="p-5 border-b border-campo-100 space-y-4">
          <h3 className="font-semibold text-campo-800 text-sm">{editandoId ? 'Editar liquidación' : 'Nueva liquidación'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Aplicador *</label>
              <select value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} className={inp}>
                <option value="">Seleccionar...</option>
                {aplicadores.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Desde *</label>
              <input type="date" value={form.fecha_desde} onChange={e => setForm(f => ({ ...f, fecha_desde: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className={lbl}>Hasta *</label>
              <input type="date" value={form.fecha_hasta} onChange={e => setForm(f => ({ ...f, fecha_hasta: e.target.value }))} className={inp} />
            </div>
          </div>

          {form.proveedor && form.fecha_desde && form.fecha_hasta && (
            <div className="rounded-lg bg-campo-50 border border-campo-200 px-4 py-2 text-sm text-campo-700">
              Según las aplicaciones cargadas: <b>{fmt(calcForm.ha)} ha</b> en {calcForm.n} {calcForm.n === 1 ? 'aplicación' : 'aplicaciones'}
              {calcForm.n > 0 && <> · costo de servicio promedio <b>{fmtUsdHa(calcForm.usdHa)}/ha</b></>}
            </div>
          )}

          {solapadas.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-2 text-sm text-amber-900">
              Ojo: este período se superpone con otra liquidación de {form.proveedor}
              {' '}({solapadas.map(s => `${fmtFecha(s.fecha_desde)} al ${fmtFecha(s.fecha_hasta)}`).join('; ')}). Revisá que no estés pagando dos veces las mismas aplicaciones.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Ha facturadas por el aplicador</label>
              <input type="number" step="0.01" min="0" value={form.ha_facturadas}
                onChange={e => { setTocoHa(true); setForm(f => ({ ...f, ha_facturadas: e.target.value })) }} className={inp} />
              {difForm != null && Math.abs(difForm) > 0.05 && (
                <p className="text-xs text-amber-700 mt-1">Diferencia con el sistema: {difForm > 0 ? '+' : ''}{fmt(difForm)} ha</p>
              )}
            </div>
            <div>
              <label className={lbl}>Costo (USD por ha) *</label>
              <input type="number" step="0.01" min="0" value={form.usd_ha}
                onChange={e => { setTocoUsd(true); setForm(f => ({ ...f, usd_ha: e.target.value })) }} className={inp} />
            </div>
            <div>
              <label className={lbl}>Monto a pagar</label>
              <div className="rounded-lg border border-campo-200 bg-campo-50 px-3 py-2 text-sm font-bold text-campo-900">{montoForm > 0 ? fmtUsd(montoForm) : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm text-campo-700 pb-2">
              <input type="checkbox" checked={form.pagado}
                onChange={e => setForm(f => ({ ...f, pagado: e.target.checked, fecha_pago: e.target.checked && !f.fecha_pago ? hoyISO() : f.fecha_pago }))} />
              Ya se pagó
            </label>
            {form.pagado && (
              <div>
                <label className={lbl}>Fecha de pago</label>
                <input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} className={inp} />
              </div>
            )}
            <div className={form.pagado ? '' : 'sm:col-span-2'}>
              <label className={lbl}>Observaciones</label>
              <input value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} placeholder="Ej: factura N° 0001-00001234" className={inp} />
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-2">
            <button onClick={guardar} disabled={saving} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Guardar liquidación'}
            </button>
            <button onClick={cerrarForm} className="text-sm text-campo-500 px-4 py-2 rounded-lg hover:bg-campo-100">Cancelar</button>
          </div>
        </div>
      )}

      {liqs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-5 border-b border-campo-100">
          <div className={`rounded-lg border px-4 py-3 ${totalPendiente > 0 ? 'border-amber-300 bg-amber-50' : 'border-campo-200'}`}>
            <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Pendiente de pago</div>
            <div className="text-xl font-bold text-campo-900">{fmtUsd(totalPendiente)}</div>
          </div>
          <div className="rounded-lg border border-campo-200 px-4 py-3">
            <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Pagado</div>
            <div className="text-xl font-bold text-campo-900">{fmtUsd(totalPagado)}</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-campo-100">
              <th className="text-left px-4 py-2 font-semibold text-campo-700">Aplicador</th>
              <th className="text-left px-4 py-2 font-semibold text-campo-700">Período</th>
              <th className="text-right px-4 py-2 font-semibold text-campo-700">Ha en sistema</th>
              <th className="text-right px-4 py-2 font-semibold text-campo-700">Ha facturadas</th>
              <th className="text-right px-4 py-2 font-semibold text-campo-700">Dif.</th>
              <th className="text-right px-4 py-2 font-semibold text-campo-700">USD/ha</th>
              <th className="text-right px-4 py-2 font-semibold text-campo-700">Monto</th>
              <th className="text-left px-4 py-2 font-semibold text-campo-700">Estado</th>
              <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-5 py-8 text-center text-campo-400">Cargando...</td></tr>}
            {!loading && filas.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-campo-400">Todavía no registraste liquidaciones. Usá “+ Nueva liquidación”.</td></tr>}
            {filas.map(({ l, haSistema, haFact, dif, monto }) => (
              <tr key={l.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                <td className="px-4 py-2 font-medium text-campo-900">{l.proveedor}</td>
                <td className="px-4 py-2 text-campo-600 whitespace-nowrap">{fmtFecha(l.fecha_desde)} – {fmtFecha(l.fecha_hasta)}</td>
                <td className="px-4 py-2 text-right text-campo-700">{fmt(haSistema)}</td>
                <td className="px-4 py-2 text-right text-campo-700">{haFact != null ? fmt(haFact) : '—'}</td>
                <td className={`px-4 py-2 text-right ${dif != null && Math.abs(dif) > 0.05 ? 'text-amber-700 font-medium' : 'text-campo-400'}`}>
                  {dif != null ? `${dif > 0 ? '+' : ''}${fmt(dif)}` : '—'}
                </td>
                <td className="px-4 py-2 text-right text-campo-700">{fmtUsdHa(Number(l.usd_ha))}</td>
                <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(monto)}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {l.pagado
                    ? <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Pagado {fmtFecha(l.fecha_pago)}</span>
                    : <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Pendiente</span>}
                </td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                  <div className="flex gap-3 justify-center">
                    {l.pagado
                      ? <button onClick={() => desmarcarPagado(l)} className="text-xs text-campo-500 hover:text-campo-800 font-medium">Pasar a pendiente</button>
                      : <button onClick={() => marcarPagado(l)} className="text-xs text-emerald-700 hover:text-emerald-600 font-medium">Marcar pagado</button>}
                    <button onClick={() => editar(l)} className="text-xs text-lime-700 hover:text-lime-600 font-medium">Editar</button>
                    <button onClick={() => borrar(l)} className="text-xs text-red-400 hover:text-red-600 font-medium">Borrar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
