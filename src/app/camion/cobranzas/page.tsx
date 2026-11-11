'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtUsd, fmtNum, fmtFecha, hoy, n } from '@/lib/camion'

type Cuenta = {
  cliente_id: number; cliente: string; activo: boolean; viajes: number; tn: number
  facturado_usd: number; cobrado_usd: number; saldo_usd: number; ultimo_viaje: string | null; ultimo_cobro: string | null
}
type ViajeT = { id: number; fecha: string; carga: string | null; origen: string | null; destino: string | null; toneladas: number; tarifa_usd_tn: number; monto_usd: number; numero_cpe: string | null }
type Cobro = { id: number; fecha: string; monto_usd: number; medio: string | null; observaciones: string | null }

export default function CobranzasPage() {
  const supabase = createClient()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Cuenta | null>(null)
  const [viajes, setViajes] = useState<ViajeT[]>([])
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [formCobro, setFormCobro] = useState({ fecha: hoy(), monto_usd: '', medio: '', observaciones: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCli, setShowCli] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', cuit: '', telefono: '' })

  async function cargar(mantenerId?: number) {
    setLoading(true)
    const { data } = await supabase.from('vw_camion_cuenta_clientes').select('*').order('saldo_usd', { ascending: false })
    const lista = (data ?? []) as Cuenta[]
    setCuentas(lista)
    setLoading(false)
    const id = mantenerId ?? sel?.cliente_id
    if (id) {
      const c = lista.find(x => x.cliente_id === id) ?? null
      setSel(c)
      if (c) cargarDetalle(c.cliente_id)
    }
  }
  async function cargarDetalle(clienteId: number) {
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('camion_viajes_terceros').select('id, fecha, carga, origen, destino, toneladas, tarifa_usd_tn, monto_usd, numero_cpe').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
      supabase.from('camion_cobranzas').select('id, fecha, monto_usd, medio, observaciones').eq('cliente_id', clienteId).order('fecha', { ascending: false }),
    ])
    setViajes((v ?? []) as ViajeT[])
    setCobros((c ?? []) as Cobro[])
  }
  useEffect(() => { cargar() }, [])

  function abrir(c: Cuenta) {
    setSel(c); setError(null)
    setFormCobro({ fecha: hoy(), monto_usd: c.saldo_usd > 0 ? String(c.saldo_usd) : '', medio: '', observaciones: '' })
    cargarDetalle(c.cliente_id)
  }

  async function registrarCobro() {
    if (!sel) return
    setError(null)
    if (!formCobro.fecha || !formCobro.monto_usd || n(formCobro.monto_usd) <= 0) { setError('Completá fecha y un monto mayor a 0.'); return }
    setSaving(true)
    const { error } = await supabase.from('camion_cobranzas').insert({
      cliente_id: sel.cliente_id, fecha: formCobro.fecha, monto_usd: Number(formCobro.monto_usd),
      medio: formCobro.medio || null, observaciones: formCobro.observaciones || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setFormCobro({ fecha: hoy(), monto_usd: '', medio: '', observaciones: '' })
    cargar(sel.cliente_id)
  }

  async function borrarCobro(id: number) {
    if (!sel || !confirm('¿Borrar este cobro?')) return
    const { error } = await supabase.from('camion_cobranzas').delete().eq('id', id)
    if (error) alert(error.message)
    cargar(sel.cliente_id)
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

  const totFact = cuentas.reduce((a, c) => a + n(c.facturado_usd), 0)
  const totCobr = cuentas.reduce((a, c) => a + n(c.cobrado_usd), 0)
  const totSaldo = cuentas.reduce((a, c) => a + n(c.saldo_usd), 0)

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Cobranzas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Cuenta corriente por cliente de los viajes que el camión hace para terceros (USD)</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Facturado a terceros</div><div className="text-lg font-bold text-campo-900">{fmtUsd(totFact)}</div></div>
        <div className="card p-4"><div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Cobrado</div><div className="text-lg font-bold text-campo-900">{fmtUsd(totCobr)}</div></div>
        <div className={`card p-4 ${totSaldo > 0.005 ? 'border-amber-300 bg-amber-50' : ''}`}><div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Saldo por cobrar</div><div className="text-lg font-bold text-campo-900">{fmtUsd(totSaldo)}</div></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right">Viajes</th>
                <th className="px-3 py-2 text-right">Facturado</th>
                <th className="px-3 py-2 text-right">Cobrado</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-campo-400">Cargando…</td></tr>}
              {!loading && cuentas.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-campo-400">Todavía no hay clientes de terceros. Se crean al cargar un viaje de tercero o con “Nuevo cliente”.</td></tr>}
              {cuentas.map(c => (
                <tr key={c.cliente_id} onClick={() => abrir(c)} className={`cursor-pointer hover:bg-campo-50/60 ${sel?.cliente_id === c.cliente_id ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">{c.cliente}</td>
                  <td className="px-3 py-2 text-right">{c.viajes}</td>
                  <td className="px-3 py-2 text-right">{fmtUsd(c.facturado_usd)}</td>
                  <td className="px-3 py-2 text-right">{fmtUsd(c.cobrado_usd)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${n(c.saldo_usd) > 0.005 ? 'text-amber-700' : n(c.saldo_usd) < -0.005 ? 'text-blue-700' : 'text-campo-500'}`}>{fmtUsd(c.saldo_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel ? (
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-campo-900">{sel.cliente}</h2>
                <span className={`text-sm font-semibold ${n(sel.saldo_usd) > 0.005 ? 'text-amber-700' : 'text-campo-500'}`}>Saldo: {fmtUsd(sel.saldo_usd)}</span>
              </div>
              <h3 className="text-xs font-semibold text-campo-500 uppercase tracking-wider">Registrar cobro</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Fecha *</label><input type="date" value={formCobro.fecha} onChange={e => setFormCobro(f => ({ ...f, fecha: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Monto (USD) *</label><input type="number" step="0.01" min="0" value={formCobro.monto_usd} onChange={e => setFormCobro(f => ({ ...f, monto_usd: e.target.value }))} className={inp} /></div>
                <div><label className={lbl}>Medio</label><input value={formCobro.medio} onChange={e => setFormCobro(f => ({ ...f, medio: e.target.value }))} placeholder="Transferencia, efectivo, cheque…" className={inp} /></div>
                <div><label className={lbl}>Observaciones</label><input value={formCobro.observaciones} onChange={e => setFormCobro(f => ({ ...f, observaciones: e.target.value }))} className={inp} /></div>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
              <button onClick={registrarCobro} disabled={saving} className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
                {saving ? 'Guardando…' : 'Registrar cobro'}
              </button>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-campo-100 font-semibold text-sm text-campo-900">Cobros</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-campo-50">
                  {cobros.length === 0 && <tr><td className="px-4 py-4 text-center text-campo-400">Sin cobros registrados</td></tr>}
                  {cobros.map(c => (
                    <tr key={c.id}>
                      <td className="px-4 py-2 whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                      <td className="px-4 py-2">{c.medio ?? '—'}{c.observaciones ? ` · ${c.observaciones}` : ''}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmtUsd(c.monto_usd)}</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => borrarCobro(c.id)} className="text-xs text-red-600 hover:underline">Borrar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-campo-100 font-semibold text-sm text-campo-900">Viajes facturados</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <tbody className="divide-y divide-campo-50">
                    {viajes.length === 0 && <tr><td className="px-4 py-4 text-center text-campo-400">Sin viajes cargados</td></tr>}
                    {viajes.map(v => (
                      <tr key={v.id}>
                        <td className="px-4 py-2">{fmtFecha(v.fecha)}</td>
                        <td className="px-4 py-2">{[v.carga, v.destino].filter(Boolean).join(' → ') || '—'}</td>
                        <td className="px-4 py-2 text-right">{fmtNum(v.toneladas, 2)} tn × {fmtNum(v.tarifa_usd_tn, 2)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{fmtUsd(v.monto_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-campo-400 text-sm">Seleccioná un cliente para ver sus viajes, registrar cobros y ver el saldo.</div>
        )}
      </div>
    </div>
  )
}
