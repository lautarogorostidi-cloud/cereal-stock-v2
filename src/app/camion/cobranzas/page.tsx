'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { fmtUsd, fmtNum, fmtFecha, n, MESES } from '@/lib/camion'

type Cliente = { id: number; nombre: string }
type ViajeT = {
  id: number; cliente_id: number; fecha: string; carga: string | null; origen: string | null; destino: string | null
  toneladas: number; tarifa_usd_tn: number; monto_usd: number
  pagado: boolean; fecha_pago: string | null
}

type Periodo = 'mes' | 'trimestre' | 'anio' | 'todo' | 'custom'

const pad = (x: number) => String(x).padStart(2, '0')
const ultimoDia = (y: number, m: number) => new Date(y, m, 0).getDate()

export default function FacturacionPage() {
  const supabase = createClient()
  const ahora = new Date()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [viajes, setViajes] = useState<ViajeT[]>([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [showCli, setShowCli] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', cuit: '', telefono: '' })

  const [periodo, setPeriodo] = useState<Periodo>('todo')
  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [trim, setTrim] = useState(Math.floor(ahora.getMonth() / 3) + 1)
  const [desdeC, setDesdeC] = useState('')
  const [hastaC, setHastaC] = useState('')

  async function cargar() {
    setLoading(true)
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('camion_clientes').select('id, nombre').eq('activo', true).order('nombre'),
      fetchAllRows<ViajeT>(() => supabase.from('camion_viajes_terceros')
        .select('id, cliente_id, fecha, carga, origen, destino, toneladas, tarifa_usd_tn, monto_usd, pagado, fecha_pago').order('fecha', { ascending: false }).order('id')),
    ])
    setClientes((c ?? []) as Cliente[])
    setViajes(v ?? [])
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const hoy = () => new Date().toISOString().slice(0, 10)

  async function marcarPago(ids: number[], pagado: boolean, fecha?: string | null) {
    if (ids.length === 0) return
    const fechaPago = pagado ? (fecha || hoy()) : null
    const previos = viajes
    setViajes(vs => vs.map(v => ids.includes(v.id) ? { ...v, pagado, fecha_pago: fechaPago } : v))
    const { error } = await supabase.from('camion_viajes_terceros').update({ pagado, fecha_pago: fechaPago }).in('id', ids)
    if (error) { setViajes(previos); alert(error.message) }
  }

  async function crearCliente() {
    if (!nuevoCli.nombre.trim()) return
    const { error } = await supabase.from('camion_clientes').insert({
      nombre: nuevoCli.nombre.trim(), cuit: nuevoCli.cuit || null, telefono: nuevoCli.telefono || null,
    })
    if (error) { alert(error.message); return }
    setNuevoCli({ nombre: '', cuit: '', telefono: '' }); setShowCli(false)
    cargar()
  }

  const anios = useMemo(() => {
    const s = new Set<number>([ahora.getFullYear()])
    viajes.forEach(v => s.add(parseInt(v.fecha.slice(0, 4), 10)))
    return Array.from(s).sort((a, b) => b - a)
  }, [viajes])

  const [desde, hasta] = useMemo<[string, string]>(() => {
    if (periodo === 'mes') return [`${anio}-${pad(mes)}-01`, `${anio}-${pad(mes)}-${ultimoDia(anio, mes)}`]
    if (periodo === 'trimestre') {
      const m1 = (trim - 1) * 3 + 1, m3 = m1 + 2
      return [`${anio}-${pad(m1)}-01`, `${anio}-${pad(m3)}-${ultimoDia(anio, m3)}`]
    }
    if (periodo === 'anio') return [`${anio}-01-01`, `${anio}-12-31`]
    if (periodo === 'custom') return [desdeC || '0000-01-01', hastaC || '9999-12-31']
    return ['0000-01-01', '9999-12-31']
  }, [periodo, anio, mes, trim, desdeC, hastaC])

  const viajesPeriodo = useMemo(() => viajes.filter(v => v.fecha >= desde && v.fecha <= hasta), [viajes, desde, hasta])

  const cuentas = useMemo(() => {
    const m = new Map<number, { viajes: number; facturado: number; cobrado: number; pendientes: number }>()
    viajesPeriodo.forEach(v => {
      const r = m.get(v.cliente_id) ?? { viajes: 0, facturado: 0, cobrado: 0, pendientes: 0 }
      r.viajes += 1
      r.facturado += n(v.monto_usd)
      if (v.pagado) r.cobrado += n(v.monto_usd)
      else r.pendientes += 1
      m.set(v.cliente_id, r)
    })
    return clientes
      .map(c => {
        const r = m.get(c.id)
        const facturado = r?.facturado ?? 0, cobrado = r?.cobrado ?? 0
        return { id: c.id, nombre: c.nombre, viajes: r?.viajes ?? 0, facturado, cobrado, pendiente: facturado - cobrado, pendientes: r?.pendientes ?? 0 }
      })
      // con "Todo" se muestran todos los clientes; con un período, solo los que tuvieron viajes
      .filter(c => periodo === 'todo' || c.viajes > 0)
      // primero los que más deben
      .sort((a, b) => b.pendiente - a.pendiente || b.facturado - a.facturado || a.nombre.localeCompare(b.nombre))
  }, [clientes, viajesPeriodo, periodo])

  const q = busqueda.trim().toLowerCase()
  const visibles = q ? cuentas.filter(c => c.nombre.toLowerCase().includes(q)) : cuentas

  const totFact = visibles.reduce((a, c) => a + c.facturado, 0)
  const totViajes = visibles.reduce((a, c) => a + c.viajes, 0)
  const totCobrado = visibles.reduce((a, c) => a + c.cobrado, 0)
  const totPendiente = visibles.reduce((a, c) => a + c.pendiente, 0)

  const sel = cuentas.find(c => c.id === selId) ?? null
  const viajesSel = sel ? viajesPeriodo.filter(v => v.cliente_id === sel.id) : []

  const tituloPeriodo =
    periodo === 'mes' ? `${MESES[mes - 1]} ${anio}` :
    periodo === 'trimestre' ? `T${trim} ${anio}` :
    periodo === 'anio' ? String(anio) :
    periodo === 'todo' ? 'Todo el historial' : 'Período personalizado'

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'
  const selCls = 'rounded-lg border border-campo-200 px-3 py-1.5 text-sm bg-white'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Facturación</h1>
          <p className="text-campo-500 text-sm mt-0.5">Quién pagó los viajes que el camión hace para terceros y quién todavía debe (USD)</p>
        </div>
        <button onClick={() => setShowCli(!showCli)} className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg">+ Nuevo cliente</button>
      </div>

      {showCli && (
        <div className="card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={lbl}>Nombre *</label><input value={nuevoCli.nombre} onChange={e => setNuevoCli(c => ({ ...c, nombre: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>CUIT</label><input value={nuevoCli.cuit} onChange={e => setNuevoCli(c => ({ ...c, cuit: e.target.value }))} className={inp} /></div>
            <div><label className={lbl}>Teléfono</label><input value={nuevoCli.telefono} onChange={e => setNuevoCli(c => ({ ...c, telefono: e.target.value }))} className={inp} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={crearCliente} disabled={!nuevoCli.nombre.trim()} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">Guardar cliente</button>
            <button onClick={() => setShowCli(false)} className="text-sm text-campo-500 px-4 py-2 rounded-lg hover:bg-campo-100">Cancelar</button>
          </div>
        </div>
      )}

      {/* Selector de período */}
      <div className="card p-4 flex flex-wrap items-center gap-2">
        {([['mes', 'Mes'], ['trimestre', 'Trimestre'], ['anio', 'Año'], ['todo', 'Todo'], ['custom', 'Personalizado']] as [Periodo, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setPeriodo(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${periodo === k ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-campo-700 border-campo-200 hover:bg-campo-50'}`}>
            {l}
          </button>
        ))}
        <div className="w-px h-6 bg-campo-200 mx-1" />
        {(periodo === 'mes' || periodo === 'trimestre' || periodo === 'anio') && (
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={selCls}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {periodo === 'mes' && (
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className={selCls}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}
        {periodo === 'trimestre' && (
          <select value={trim} onChange={e => setTrim(Number(e.target.value))} className={selCls}>
            {[1, 2, 3, 4].map(t => <option key={t} value={t}>T{t}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-campo-500">Desde</span>
          <input type="date" value={desde.startsWith('0000') ? '' : desde}
            onChange={e => { setDesdeC(e.target.value); setHastaC(hasta.startsWith('9999') ? '' : hasta); setPeriodo('custom') }} className={selCls} />
          <span className="text-xs font-medium text-campo-500">Hasta</span>
          <input type="date" value={hasta.startsWith('9999') ? '' : hasta}
            onChange={e => { setHastaC(e.target.value); setDesdeC(desde.startsWith('0000') ? '' : desde); setPeriodo('custom') }} className={selCls} />
        </div>
        <div className="ml-auto text-sm font-semibold text-campo-700">{tituloPeriodo}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Total facturado</div>
          <div className="text-lg font-bold text-campo-900">{fmtUsd(totFact)}</div>
          <div className="text-xs text-campo-400 mt-0.5">{totViajes} {totViajes === 1 ? 'viaje' : 'viajes'}{q ? ' (según la búsqueda)' : ''}</div>
        </div>
      </div>

      <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cliente..."
        className="w-full sm:max-w-sm rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right">Viajes</th>
                <th className="px-3 py-2 text-right">Facturado</th>
                <th className="px-3 py-2 text-right">Cobrado</th>
                <th className="px-3 py-2 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-campo-400">Cargando…</td></tr>}
              {!loading && cuentas.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-campo-400">{periodo === 'todo' ? 'Todavía no hay clientes de terceros. Se crean al cargar un viaje de tercero o con “Nuevo cliente”.' : 'No hay viajes facturados en este período.'}</td></tr>}
              {!loading && cuentas.length > 0 && visibles.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-campo-400">Ningún cliente coincide con la búsqueda.</td></tr>}
              {visibles.map(c => (
                <tr key={c.id} onClick={() => setSelId(c.id)} className={`cursor-pointer hover:bg-campo-50/60 ${selId === c.id ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">{c.nombre}</td>
                  <td className="px-3 py-2 text-right">{c.viajes}</td>
                  <td className="px-3 py-2 text-right">{fmtUsd(c.facturado)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtUsd(c.cobrado)}</td>
                  <td className="px-3 py-2 text-right">
                    {c.pendiente > 0.005
                      ? <><span className="font-semibold text-red-600">{fmtUsd(c.pendiente)}</span><div className="text-[11px] text-campo-400">{c.pendientes} {c.pendientes === 1 ? 'viaje' : 'viajes'}</div></>
                      : c.viajes > 0 ? <span className="text-xs font-medium text-emerald-700">Al día</span> : <span className="text-campo-300">—</span>}
                  </td>
                </tr>
              ))}
              {visibles.length > 0 && (
                <tr className="bg-campo-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{totViajes}</td>
                  <td className="px-3 py-2 text-right">{fmtUsd(totFact)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{fmtUsd(totCobrado)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmtUsd(totPendiente)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {sel ? (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-campo-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm text-campo-900">{sel.nombre} — viajes</h2>
                <div className="text-xs text-campo-500 mt-0.5">
                  Facturado {fmtUsd(sel.facturado)} · Cobrado <span className="text-emerald-700">{fmtUsd(sel.cobrado)}</span> · Pendiente <span className={sel.pendiente > 0.005 ? 'text-red-600 font-semibold' : ''}>{fmtUsd(sel.pendiente)}</span>
                </div>
              </div>
              {sel.pendientes > 0 && (
                <button
                  onClick={() => { if (confirm(`¿Marcar como cobrados los ${sel.pendientes} viajes pendientes de ${sel.nombre} (${fmtUsd(sel.pendiente)})?`)) marcarPago(viajesSel.filter(v => !v.pagado).map(v => v.id), true) }}
                  className="text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg">
                  Marcar todos cobrados
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Viaje</th>
                    <th className="px-4 py-2 text-right">Detalle</th>
                    <th className="px-4 py-2 text-right">Monto</th>
                    <th className="px-4 py-2 text-left">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-campo-50">
                  {viajesSel.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-campo-400">Sin viajes en este período</td></tr>}
                  {viajesSel.map(v => (
                    <tr key={v.id} className={v.pagado ? '' : 'bg-red-50/40'}>
                      <td className="px-4 py-2">{fmtFecha(v.fecha)}</td>
                      <td className="px-4 py-2">{[v.carga, v.destino].filter(Boolean).join(' → ') || '—'}</td>
                      <td className="px-4 py-2 text-right">{fmtNum(v.toneladas, 2)} tn × {fmtNum(v.tarifa_usd_tn, 2)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmtUsd(v.monto_usd)}</td>
                      <td className="px-4 py-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={v.pagado} onChange={e => marcarPago([v.id], e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                          {v.pagado
                            ? <input type="date" value={v.fecha_pago ?? ''} onChange={e => marcarPago([v.id], true, e.target.value || hoy())} className="rounded border border-campo-200 px-1.5 py-0.5 text-xs bg-white" />
                            : <span className="text-xs font-medium text-red-600">Pendiente</span>}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-campo-400 text-sm">Seleccioná un cliente para ver sus viajes y marcar cuáles ya pagó.</div>
        )}
      </div>
    </div>
  )
}
