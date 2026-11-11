'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import {
  ViajeCamion, CostoCamion, CATEGORIAS_COSTO, etiquetaCategoria,
  fmtUsd, fmtNum, claveMes, claveTrimestre, etiquetaClave, MESES, n,
} from '@/lib/camion'

type Periodo = 'mes' | 'trimestre' | 'anio' | 'todo' | 'custom'

const pad = (x: number) => String(x).padStart(2, '0')
const ultimoDia = (y: number, m: number) => new Date(y, m, 0).getDate()

export default function RentabilidadCamionPage() {
  const supabase = createClient()
  const ahora = new Date()
  const [viajes, setViajes] = useState<ViajeCamion[]>([])
  const [costos, setCostos] = useState<CostoCamion[]>([])
  const [loading, setLoading] = useState(true)

  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [anio, setAnio] = useState(ahora.getFullYear())
  const [mes, setMes] = useState(ahora.getMonth() + 1)
  const [trim, setTrim] = useState(Math.floor(ahora.getMonth() / 3) + 1)
  const [desdeC, setDesdeC] = useState('')
  const [hastaC, setHastaC] = useState('')
  const [agrupar, setAgrupar] = useState<'mes' | 'trimestre'>('mes')

  useEffect(() => {
    (async () => {
      const [{ data: v }, { data: c }] = await Promise.all([
        fetchAllRows<ViajeCamion>(() => supabase.from('vw_camion_viajes').select('*').order('fecha').order('viaje_id')),
        fetchAllRows<CostoCamion>(() => supabase.from('camion_costos').select('*').order('fecha').order('id')),
      ])
      setViajes(v ?? []); setCostos(c ?? []); setLoading(false)
    })()
  }, [])

  const anios = useMemo(() => {
    const s = new Set<number>([ahora.getFullYear()])
    viajes.forEach(v => s.add(parseInt(v.fecha.slice(0, 4), 10)))
    costos.forEach(c => s.add(parseInt(c.fecha.slice(0, 4), 10)))
    return Array.from(s).sort((a, b) => b - a)
  }, [viajes, costos])

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

  const v = useMemo(() => viajes.filter(x => x.fecha >= desde && x.fecha <= hasta), [viajes, desde, hasta])
  const c = useMemo(() => costos.filter(x => x.fecha >= desde && x.fecha <= hasta), [costos, desde, hasta])

  const r = useMemo(() => {
    const propios = v.filter(x => x.origen_viaje === 'propio')
    const terceros = v.filter(x => x.origen_viaje === 'tercero')
    const sum = (arr: ViajeCamion[], k: keyof ViajeCamion) => arr.reduce((a, x) => a + n(x[k]), 0)
    const ingProp = sum(propios, 'ingreso_usd'), ingTerc = sum(terceros, 'ingreso_usd')
    const chofer = sum(v, 'costo_chofer_usd')
    const comb = c.filter(x => x.categoria === 'combustible').reduce((a, x) => a + n(x.monto_usd), 0)
    const litros = c.filter(x => x.categoria === 'combustible').reduce((a, x) => a + n(x.litros), 0)
    const otros = c.filter(x => x.categoria !== 'combustible').reduce((a, x) => a + n(x.monto_usd), 0)
    const ingresos = ingProp + ingTerc
    const resultado = ingresos - chofer - comb - otros
    const tn = sum(v, 'tn')
    return {
      viajes: v.length, nProp: propios.length, nTerc: terceros.length, tn,
      ingProp, ingTerc, ingresos, chofer, comb, litros, otros, resultado,
      margen: ingresos > 0 ? (resultado / ingresos) * 100 : 0,
      combPorTn: tn > 0 ? comb / tn : 0,
      resPorTn: tn > 0 ? resultado / tn : 0,
    }
  }, [v, c])

  const porCategoria = useMemo(() => {
    const m: Record<string, number> = {}
    c.forEach(x => { m[x.categoria] = (m[x.categoria] ?? 0) + n(x.monto_usd) })
    return m
  }, [c])

  const serie = useMemo(() => {
    const clave = agrupar === 'mes' ? claveMes : claveTrimestre
    const m = new Map<string, { viajes: number; tn: number; ing: number; chofer: number; comb: number; otros: number }>()
    const get = (k: string) => { if (!m.has(k)) m.set(k, { viajes: 0, tn: 0, ing: 0, chofer: 0, comb: 0, otros: 0 }); return m.get(k)! }
    v.forEach(x => { const o = get(clave(x.fecha)); o.viajes++; o.tn += n(x.tn); o.ing += n(x.ingreso_usd); o.chofer += n(x.costo_chofer_usd) })
    c.forEach(x => { const o = get(clave(x.fecha)); if (x.categoria === 'combustible') o.comb += n(x.monto_usd); else o.otros += n(x.monto_usd) })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, o]) => ({
      k, ...o, resultado: o.ing - o.chofer - o.comb - o.otros,
    }))
  }, [v, c, agrupar])

  const maxAbs = Math.max(1, ...serie.map(s => Math.abs(s.resultado)))
  const sinCostos = !loading && costos.length === 0

  const tituloPeriodo =
    periodo === 'mes' ? `${MESES[mes - 1]} ${anio}` :
    periodo === 'trimestre' ? `T${trim} ${anio}` :
    periodo === 'anio' ? String(anio) :
    periodo === 'todo' ? 'Todo el historial' : 'Período personalizado'

  const sel = 'rounded-lg border border-campo-200 px-3 py-1.5 text-sm bg-white'

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando…</div>

  const Kpi = ({ label, value, sub, tono }: { label: string; value: string; sub?: string; tono?: 'ok' | 'mal' }) => (
    <div className={`card p-5 ${tono === 'mal' ? 'border-red-200 bg-red-50' : tono === 'ok' ? 'border-emerald-200 bg-emerald-50' : ''}`}>
      <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${tono === 'mal' ? 'text-red-700' : 'text-campo-900'}`}>{value}</div>
      {sub && <div className="text-xs text-campo-400 mt-0.5">{sub}</div>}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Rentabilidad del camión</h1>
        <p className="text-campo-500 text-sm mt-0.5">Ingresos por flete menos costo del chofer, combustible y demás gastos. Todo en USD, visto por período.</p>
      </div>

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
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className={sel}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {periodo === 'mes' && (
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className={sel}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        )}
        {periodo === 'trimestre' && (
          <select value={trim} onChange={e => setTrim(Number(e.target.value))} className={sel}>
            {[1, 2, 3, 4].map(t => <option key={t} value={t}>T{t}</option>)}
          </select>
        )}
        {periodo === 'custom' && (
          <>
            <input type="date" value={desdeC} onChange={e => setDesdeC(e.target.value)} className={sel} />
            <span className="text-campo-400 text-sm">a</span>
            <input type="date" value={hastaC} onChange={e => setHastaC(e.target.value)} className={sel} />
          </>
        )}
        <div className="ml-auto text-sm font-semibold text-campo-700">{tituloPeriodo}</div>
      </div>

      {sinCostos && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Todavía no cargaste costos (combustible, repuestos, etc.), así que el resultado muestra solo ingresos menos chofer.{' '}
          <Link href="/camion/costos" className="underline font-medium">Cargar costos</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Resultado" value={fmtUsd(r.resultado)} sub={`Margen ${fmtNum(r.margen, 1)}% · USD ${fmtNum(r.resPorTn, 2)}/tn`} tono={r.resultado < 0 ? 'mal' : r.ingresos > 0 ? 'ok' : undefined} />
        <Kpi label="Ingresos por flete" value={fmtUsd(r.ingresos)} sub={`Propios ${fmtUsd(r.ingProp)} · Terceros ${fmtUsd(r.ingTerc)}`} />
        <Kpi label="Viajes" value={String(r.viajes)} sub={`${r.nProp} propios · ${r.nTerc} terceros · ${fmtNum(r.tn, 1)} tn`} />
        <Kpi label="Costos totales" value={fmtUsd(r.chofer + r.comb + r.otros)} sub={`Chofer ${fmtUsd(r.chofer)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de resultado del período */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-campo-100 font-semibold text-campo-900">Resultado del período</div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-campo-50">
              <tr><td className="px-5 py-2">Flete viajes propios (cartas de porte)</td><td className="px-5 py-2 text-right">{fmtUsd(r.ingProp)}</td></tr>
              <tr><td className="px-5 py-2">Flete viajes de terceros</td><td className="px-5 py-2 text-right">{fmtUsd(r.ingTerc)}</td></tr>
              <tr className="bg-campo-50 font-semibold"><td className="px-5 py-2">Ingresos</td><td className="px-5 py-2 text-right">{fmtUsd(r.ingresos)}</td></tr>
              <tr><td className="px-5 py-2 text-campo-600">− Chofer (tn × tarifa)</td><td className="px-5 py-2 text-right text-campo-600">{fmtUsd(r.chofer)}</td></tr>
              <tr><td className="px-5 py-2 text-campo-600">− Combustible</td><td className="px-5 py-2 text-right text-campo-600">{fmtUsd(r.comb)}</td></tr>
              {CATEGORIAS_COSTO.filter(x => x.value !== 'combustible' && porCategoria[x.value]).map(x => (
                <tr key={x.value}><td className="px-5 py-2 text-campo-600">− {x.label}</td><td className="px-5 py-2 text-right text-campo-600">{fmtUsd(porCategoria[x.value])}</td></tr>
              ))}
              <tr className="bg-campo-50 font-bold"><td className="px-5 py-2">Resultado</td><td className={`px-5 py-2 text-right ${r.resultado < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtUsd(r.resultado)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Combustible (informativo) */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-campo-100 font-semibold text-campo-900">Combustible del período</div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <div><div className="text-xs text-campo-500 uppercase tracking-wider">Gastado</div><div className="text-lg font-bold">{fmtUsd(r.comb)}</div></div>
            <div><div className="text-xs text-campo-500 uppercase tracking-wider">Litros cargados</div><div className="text-lg font-bold">{fmtNum(r.litros, 0)} L</div></div>
            <div><div className="text-xs text-campo-500 uppercase tracking-wider">Precio medio</div><div className="text-lg font-bold">{r.litros > 0 ? `USD ${(r.comb / r.litros).toFixed(3)}/L` : '—'}</div></div>
            <div><div className="text-xs text-campo-500 uppercase tracking-wider">Por tonelada transportada</div><div className="text-lg font-bold">{r.tn > 0 ? `USD ${fmtNum(r.combPorTn, 2)}/tn` : '—'}</div></div>
            <div className="col-span-2 text-xs text-campo-400">
              El combustible se carga acumulado y no se asigna a cada viaje; por eso acá se mide contra las toneladas del período.
              Para ver cómo rinde, compará períodos largos (trimestre o año).
            </div>
          </div>
        </div>
      </div>

      {/* Evolución */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-campo-900">Evolución</h2>
          <div className="flex gap-1">
            {(['mes', 'trimestre'] as const).map(k => (
              <button key={k} onClick={() => setAgrupar(k)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border ${agrupar === k ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-campo-700 border-campo-200'}`}>
                Por {k === 'mes' ? 'mes' : 'trimestre'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-campo-50 text-campo-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Período</th>
                <th className="px-4 py-2 text-right">Viajes</th>
                <th className="px-4 py-2 text-right">Tn</th>
                <th className="px-4 py-2 text-right">Ingresos</th>
                <th className="px-4 py-2 text-right">Chofer</th>
                <th className="px-4 py-2 text-right">Combustible</th>
                <th className="px-4 py-2 text-right">Otros costos</th>
                <th className="px-4 py-2 text-right">Resultado</th>
                <th className="px-4 py-2 text-right">Margen</th>
                <th className="px-4 py-2 w-48" />
              </tr>
            </thead>
            <tbody className="divide-y divide-campo-50">
              {serie.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-campo-400">Sin movimientos en este período</td></tr>}
              {serie.map(s => (
                <tr key={s.k}>
                  <td className="px-4 py-2 font-medium">{etiquetaClave(s.k)}</td>
                  <td className="px-4 py-2 text-right">{s.viajes}</td>
                  <td className="px-4 py-2 text-right">{fmtNum(s.tn, 1)}</td>
                  <td className="px-4 py-2 text-right">{fmtUsd(s.ing)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(s.chofer)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(s.comb)}</td>
                  <td className="px-4 py-2 text-right text-campo-600">{fmtUsd(s.otros)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${s.resultado < 0 ? 'text-red-700' : 'text-campo-900'}`}>{fmtUsd(s.resultado)}</td>
                  <td className="px-4 py-2 text-right">{s.ing > 0 ? `${fmtNum((s.resultado / s.ing) * 100, 1)}%` : '—'}</td>
                  <td className="px-4 py-2">
                    <div className="h-2.5 rounded-full bg-campo-100 overflow-hidden">
                      <div className={`h-full rounded-full ${s.resultado < 0 ? 'bg-red-400' : 'bg-emerald-500'}`} style={{ width: `${Math.max(2, (Math.abs(s.resultado) / maxAbs) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-campo-400">
        Los meses con combustible o repuestos sin cargar se ven más rentables de lo real: conviene mirar trimestres o períodos largos y cargar los costos al día.
        Costos cargados: {c.length} · Categorías: {Object.keys(porCategoria).map(etiquetaCategoria).join(', ') || 'ninguna'}.
      </p>
    </div>
  )
}
