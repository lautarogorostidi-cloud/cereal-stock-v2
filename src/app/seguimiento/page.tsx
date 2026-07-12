'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Resumen = {
  ciclo_id: number
  campana: string
  lote: string
  campo: string
  hectareas: number
  cultivo: string
  sup_sembrada: number
  sup_cosechada: number | null
  rinde_kg_ha: number | null
  rinde_kg_total: number | null
  costo_semillas_usd: number
  costo_insumos_usd: number
  costo_fertilizantes_usd: number
  costo_servicios_usd: number
  costo_fijos_usd: number
}

type Acondicionamiento = { ciclo_id: number; superficie_ha: number | null; costo_usd_ha: number | null }

type Siembra = {
  ciclo_id: number
  costo_semilla_total: number | null
  costo_servicio_total: number | null
  sup_hibrido_1: number | null
  fertilizante_1_kg_ha: number | null
  fertilizante_1_costo_kg: number | null
  fertilizante_2_kg_ha: number | null
  fertilizante_2_costo_kg: number | null
}

type Aplicacion = { id: number; ciclo_id: number; tipo: string; superficie_ha: number | null; costo_servicio_usd_ha: number | null }
type AplicacionProducto = { aplicacion_id: number; dosis_ha: number | null; costo_unitario: number | null }
type Fertilizacion = { ciclo_id: number; superficie_ha: number | null; costo_usd_ha: number | null; costo_servicio_usd_ha: number | null }
type Cosecha = { ciclo_id: number; superficie_ha: number | null; costo_cosecha_usd_ha: number | null }
type Resiembra = { ciclo_id: number; superficie_ha: number | null }

const ORDEN_INSUMOS = ['Semillas', 'Fertilizante', 'Fitosanitario']

const ORDEN_SERVICIOS = ['Acondicionado', 'Siembra', 'Pulverización', 'Fertilización', 'Cosecha']

const ORDEN_HECTAREAS = ['Acondicionado', 'Siembra', 'Pulverización', 'Fertilización', 'Cosecha', 'Resiembra']

export default function SeguimientoDashboard() {
  const supabase = createClient()
  const [ciclos, setCiclos] = useState<Resumen[]>([])
  const [campanas, setCampanas] = useState<string[]>([])
  const [campanaActual, setCampanaActual] = useState('')
  const [acondicionamientos, setAcondicionamientos] = useState<Acondicionamiento[]>([])
  const [siembras, setSiembras] = useState<Siembra[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [aplProductos, setAplProductos] = useState<AplicacionProducto[]>([])
  const [fertilizaciones, setFertilizaciones] = useState<Fertilizacion[]>([])
  const [cosechas, setCosechas] = useState<Cosecha[]>([])
  const [resiembras, setResiembras] = useState<Resiembra[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [
        { data: cs }, { data: caps },
        { data: acon }, { data: siem }, { data: apls }, { data: aplProds },
        { data: fert }, { data: cos }, { data: resi },
      ] = await Promise.all([
        supabase.from('vw_sa_resumen_ciclo').select('*'),
        supabase.from('campanas').select('nombre').order('nombre', { ascending: false }),
        supabase.from('sa_acondicionamiento').select('ciclo_id, superficie_ha, costo_usd_ha').limit(10000),
        supabase.from('sa_siembras').select('ciclo_id, costo_semilla_total, costo_servicio_total, sup_hibrido_1, fertilizante_1_kg_ha, fertilizante_1_costo_kg, fertilizante_2_kg_ha, fertilizante_2_costo_kg').limit(10000),
        supabase.from('sa_aplicaciones').select('id, ciclo_id, tipo, superficie_ha, costo_servicio_usd_ha').limit(10000),
        supabase.from('sa_aplicacion_productos').select('aplicacion_id, dosis_ha, costo_unitario').limit(10000),
        supabase.from('sa_fertilizaciones').select('ciclo_id, superficie_ha, costo_usd_ha, costo_servicio_usd_ha').limit(10000),
        supabase.from('sa_cosechas').select('ciclo_id, superficie_ha, costo_cosecha_usd_ha').limit(10000),
        supabase.from('sa_resiembras').select('ciclo_id, superficie_ha').limit(10000),
      ])
      const nombres = (caps ?? []).map((c: any) => c.nombre)
      setCiclos(cs ?? [])
      setCampanas(nombres)
      setCampanaActual(nombres[0] ?? '')
      setAcondicionamientos(acon ?? [])
      setSiembras(siem ?? [])
      setAplicaciones(apls ?? [])
      setAplProductos(aplProds ?? [])
      setFertilizaciones(fert ?? [])
      setCosechas(cos ?? [])
      setResiembras(resi ?? [])
      setLoading(false)
    }
    cargar()
  }, [])

  const fmt = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const fmtUsd = (n: number) =>
    `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  const ciclosCampana = ciclos.filter(r => r.campana === campanaActual)
  const cicloIds = new Set(ciclosCampana.map(r => r.ciclo_id))

  const totalHaSembrada = ciclosCampana.reduce((acc, r) => acc + Number(r.sup_sembrada ?? r.hectareas ?? 0), 0)
  const totalHaCosechada = ciclosCampana.reduce((acc, r) => acc + Number(r.sup_cosechada ?? 0), 0)
  const totalKg = ciclosCampana.reduce((acc, r) => acc + Number(r.rinde_kg_total ?? 0), 0)
  const costoTotal = ciclosCampana.reduce((acc, r) =>
    acc + Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
    Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) +
    Number(r.costo_fijos_usd ?? 0), 0)

  // ── Hectáreas trabajadas: suma de toda la actividad de la campaña ──
  const haAcondicionadas = acondicionamientos.filter(a => cicloIds.has(a.ciclo_id)).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)
  const haPulverizadas = aplicaciones.filter(a => cicloIds.has(a.ciclo_id)).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)
  const haFertilizadas = fertilizaciones.filter(f => cicloIds.has(f.ciclo_id)).reduce((acc, f) => acc + Number(f.superficie_ha ?? 0), 0)
  const haResembradas = resiembras.filter(r => cicloIds.has(r.ciclo_id)).reduce((acc, r) => acc + Number(r.superficie_ha ?? 0), 0)
  const haTrabajadas = haAcondicionadas + totalHaSembrada + haPulverizadas + haFertilizadas + totalHaCosechada + haResembradas

  const haTrabajadasDesglose: Record<string, number> = {
    Acondicionado: haAcondicionadas,
    Siembra: totalHaSembrada,
    Pulverización: haPulverizadas,
    Fertilización: haFertilizadas,
    Cosecha: totalHaCosechada,
    Resiembra: haResembradas,
  }

  // ── Costo de insumos por producto (para desglosar aplicaciones por tipo) ──
  const productosPorAplicacion: Record<number, AplicacionProducto[]> = {}
  aplProductos.forEach(p => {
    if (!productosPorAplicacion[p.aplicacion_id]) productosPorAplicacion[p.aplicacion_id] = []
    productosPorAplicacion[p.aplicacion_id].push(p)
  })

  const costoInsumos: Record<string, number> = {}
  const costoServicios: Record<string, number> = {}
  ORDEN_INSUMOS.forEach(k => { costoInsumos[k] = 0 })
  ORDEN_SERVICIOS.forEach(k => { costoServicios[k] = 0 })

  siembras.filter(s => cicloIds.has(s.ciclo_id)).forEach(s => {
    costoInsumos['Semillas'] += Number(s.costo_semilla_total ?? 0)
    const supHib1 = Number(s.sup_hibrido_1 ?? 0)
    if (s.fertilizante_1_kg_ha && s.fertilizante_1_costo_kg) {
      costoInsumos['Fertilizante'] += Number(s.fertilizante_1_kg_ha) * supHib1 * Number(s.fertilizante_1_costo_kg)
    }
    if (s.fertilizante_2_kg_ha && s.fertilizante_2_costo_kg) {
      costoInsumos['Fertilizante'] += Number(s.fertilizante_2_kg_ha) * supHib1 * Number(s.fertilizante_2_costo_kg)
    }
    costoServicios['Siembra'] += Number(s.costo_servicio_total ?? 0)
  })

  acondicionamientos.filter(a => cicloIds.has(a.ciclo_id)).forEach(a => {
    costoServicios['Acondicionado'] += Number(a.superficie_ha ?? 0) * Number(a.costo_usd_ha ?? 0)
  })

  aplicaciones.filter(a => cicloIds.has(a.ciclo_id)).forEach(a => {
    const sup = Number(a.superficie_ha ?? 0)
    costoServicios['Pulverización'] += sup * Number(a.costo_servicio_usd_ha ?? 0)
    const productos = productosPorAplicacion[a.id] ?? []
    const costoProductos = productos.reduce((acc, p) => acc + Number(p.dosis_ha ?? 0) * sup * Number(p.costo_unitario ?? 0), 0)
    costoInsumos['Fitosanitario'] += costoProductos
  })

  fertilizaciones.filter(f => cicloIds.has(f.ciclo_id)).forEach(f => {
    const sup = Number(f.superficie_ha ?? 0)
    costoInsumos['Fertilizante'] += sup * Number(f.costo_usd_ha ?? 0)
    costoServicios['Fertilización'] += sup * Number(f.costo_servicio_usd_ha ?? 0)
  })

  cosechas.filter(c => cicloIds.has(c.ciclo_id)).forEach(c => {
    costoServicios['Cosecha'] += Number(c.superficie_ha ?? 0) * Number(c.costo_cosecha_usd_ha ?? 0)
  })

  const totalInsumosDesglose = Object.values(costoInsumos).reduce((a, b) => a + b, 0)
  const totalServiciosDesglose = Object.values(costoServicios).reduce((a, b) => a + b, 0)

  const porCultivo = ciclosCampana.reduce((acc: Record<string, any>, r) => {
    if (!acc[r.cultivo]) acc[r.cultivo] = { lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costo: 0 }
    acc[r.cultivo].lotes++
    acc[r.cultivo].haSembrada += Number(r.sup_sembrada ?? r.hectareas ?? 0)
    acc[r.cultivo].haCosechada += Number(r.sup_cosechada ?? 0)
    acc[r.cultivo].kg += Number(r.rinde_kg_total ?? 0)
    acc[r.cultivo].costo += Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
      Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) + Number(r.costo_fijos_usd ?? 0)
    return acc
  }, {})

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Seguimiento Agronómico</h1>
          <p className="text-campo-500 text-sm mt-0.5">Campaña: {campanaActual}</p>
        </div>
        <select
          value={campanaActual}
          onChange={e => setCampanaActual(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
        >
          {campanas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Lotes</div>
          <div className="text-2xl font-bold text-campo-900">{ciclosCampana.length}</div>
          <div className="text-xs text-campo-400 mt-0.5">en campaña {campanaActual}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Superficie</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalHaSembrada)}</div>
          <div className="text-xs text-campo-400 mt-0.5">ha sembradas · {fmt(totalHaCosechada)} cosechadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Producción</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalKg / 1000)}</div>
          <div className="text-xs text-campo-400 mt-0.5">toneladas cosechadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Total</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(costoTotal)}</div>
          <div className="text-xs text-campo-400 mt-0.5">implantación + fijos</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Hectáreas Trabajadas</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(haTrabajadas)}</div>
          <div className="text-xs text-campo-400 mt-0.5">acondic. + siembra + pulv. + fert. + cosecha + resiembra</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Insumos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalInsumosDesglose)}</div>
          <div className="text-xs text-campo-400 mt-0.5">semillas + fertilizante + fitosanitarios</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Servicios</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalServiciosDesglose)}</div>
          <div className="text-xs text-campo-400 mt-0.5">acondic. + siembra + pulv. + fert. + cosecha</div>
        </div>
      </div>

      {/* Desglose de costos y hectáreas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Costo de Insumos por Categoría</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Categoría</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo (USD)</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_INSUMOS.filter(k => costoInsumos[k] > 0).map(k => (
                  <tr key={k} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-5 py-2 text-campo-700">{k}</td>
                    <td className="px-5 py-2 text-right font-medium text-campo-900">{fmtUsd(costoInsumos[k])}</td>
                    <td className="px-5 py-2 text-right text-campo-500">
                      {totalInsumosDesglose > 0 ? `${((costoInsumos[k] / totalInsumosDesglose) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
                {totalInsumosDesglose === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Costo de Servicios por Categoría</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Categoría</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo (USD)</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_SERVICIOS.filter(k => costoServicios[k] > 0).map(k => (
                  <tr key={k} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-5 py-2 text-campo-700">{k}</td>
                    <td className="px-5 py-2 text-right font-medium text-campo-900">{fmtUsd(costoServicios[k])}</td>
                    <td className="px-5 py-2 text-right text-campo-500">
                      {totalServiciosDesglose > 0 ? `${((costoServicios[k] / totalServiciosDesglose) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
                {totalServiciosDesglose === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Hectáreas Trabajadas por Actividad</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Actividad</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Ha</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_HECTAREAS.filter(k => haTrabajadasDesglose[k] > 0).map(k => (
                  <tr key={k} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-5 py-2 text-campo-700">{k}</td>
                    <td className="px-5 py-2 text-right font-medium text-campo-900">{fmt(haTrabajadasDesglose[k])}</td>
                    <td className="px-5 py-2 text-right text-campo-500">
                      {haTrabajadas > 0 ? `${((haTrabajadasDesglose[k] / haTrabajadas) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
                {haTrabajadas === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Resumen por cultivo */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100">
          <h2 className="font-semibold text-campo-900">Resumen por Cultivo — {campanaActual}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Lotes</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Producción (kg)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde (kg/ha)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo/ha (USD)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(porCultivo).length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay ciclos para esta campaña</td></tr>
              )}
              {Object.entries(porCultivo).map(([cultivo, data]: [string, any]) => (
                <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{cultivo}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{data.lotes}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(data.haSembrada)}</td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.haCosechada > 0 ? fmt(data.haCosechada) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.kg > 0 ? fmt(data.kg) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">
                    {data.haCosechada > 0 ? fmt(data.kg / data.haCosechada) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.haSembrada > 0 ? fmtUsd(data.costo / data.haSembrada) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
          <h2 className="font-semibold text-campo-900">Lotes — {campanaActual}</h2>
          <a href="/seguimiento/lotes" className="text-sm text-lime-700 hover:text-lime-600 font-medium">Ver todos →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo USD</th>
              </tr>
            </thead>
            <tbody>
              {ciclosCampana.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay ciclos registrados</td></tr>
              )}
              {ciclosCampana.slice(0, 10).map((r, i) => {
                const costoLote = Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
                  Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) +
                  Number(r.costo_fijos_usd ?? 0)
                return (
                  <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-campo-900">{r.lote}</td>
                    <td className="px-5 py-3 text-campo-500 text-xs">{r.campo}</td>
                    <td className="px-5 py-3 text-campo-700">{r.cultivo}</td>
                    <td className="px-5 py-3 text-right text-campo-700">{fmt(r.sup_sembrada ?? r.hectareas)}</td>
                    <td className="px-5 py-3 text-right text-campo-700">
                      {r.sup_cosechada ? fmt(r.sup_cosechada) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-campo-900">
                      {r.rinde_kg_ha ? fmt(r.rinde_kg_ha) : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-campo-700">{fmtUsd(costoLote)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
