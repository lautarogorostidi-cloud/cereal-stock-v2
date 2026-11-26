'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtUsd, fmtNum, fmtFecha, n } from '@/lib/camion'

type Cuenta = {
  cliente_id: number; cliente: string; activo: boolean; viajes: number; tn: number
  facturado_usd: number; ultimo_viaje: string | null
}
type ViajeT = { id: number; fecha: string; carga: string | null; origen: string | null; destino: string | null; toneladas: number; tarifa_usd_tn: number; monto_usd: number; numero_cpe: string | null }

export default function FacturacionPage() {
  const supabase = createClient()
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Cuenta | null>(null)
  const [viajes, setViajes] = useState<ViajeT[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [showCli, setShowCli] = useState(false)
  const [nuevoCli, setNuevoCli] = useState({ nombre: '', cuit: '', telefono: '' })

  async function cargar(mantenerId?: number) {
    setLoading(true)
    const { data } = await supabase.from('vw_camion_cuenta_clientes').select('*').eq('activo', true).order('facturado_usd', { ascending: false })
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
    const { data } = await supabase.from('camion_viajes_terceros')
      .select('id, fecha, carga, origen, destino, toneladas, tarifa_usd_tn, monto_usd, numero_cpe')
      .eq('cliente_id', clienteId).order('fecha', { ascending: false })
    setViajes((data ?? []) as ViajeT[])
  }
  useEffect(() => { cargar() }, [])

  function abrir(c: Cuenta) {
    setSel(c)
    cargarDetalle(c.cliente_id)
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

  const q = busqueda.trim().toLowerCase()
  const visibles = q ? cuentas.filter(c => c.cliente.toLowerCase().includes(q)) : cuentas

  const totFact = visibles.reduce((a, c) => a + n(c.facturado_usd), 0)
  const totViajes = visibles.reduce((a, c) => a + n(c.viajes), 0)

  const inp = 'w-full rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-amber-400'
  const lbl = 'block text-xs font-medium text-campo-700 mb-1'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Facturación</h1>
          <p className="text-campo-500 text-sm mt-0.5">Viajes y monto facturado por cliente de los viajes que el camión hace para terceros (USD)</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {loading && <tr><td colSpan={3} className="px-3 py-8 text-center text-campo-400">Cargando…</td></tr>}
              {!loading && cuentas.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-campo-400">Todavía no hay clientes de terceros. Se crean al cargar un viaje de tercero o con “Nuevo cliente”.</td></tr>}
              {!loading && cuentas.length > 0 && visibles.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-campo-400">Ningún cliente coincide con la búsqueda.</td></tr>}
              {visibles.map(c => (
                <tr key={c.cliente_id} onClick={() => abrir(c)} className={`cursor-pointer hover:bg-campo-50/60 ${sel?.cliente_id === c.cliente_id ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 font-medium">{c.cliente}</td>
                  <td className="px-3 py-2 text-right">{c.viajes}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtUsd(c.facturado_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel ? (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-campo-100 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-campo-900">{sel.cliente} — viajes facturados</h2>
              <span className="text-sm font-semibold text-campo-900">{fmtUsd(sel.facturado_usd)}</span>
            </div>
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
        ) : (
          <div className="card p-8 text-center text-campo-400 text-sm">Seleccioná un cliente para ver sus viajes facturados.</div>
        )}
      </div>
    </div>
  )
}
