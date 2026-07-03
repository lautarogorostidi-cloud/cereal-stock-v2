'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campania = { id: number; nombre: string }

type VerdeoLote = {
  ciclo_id: number; lote: string; campo: string; cultivo: string
  hectareas: number; sup_sembrada: number
  costo_semillas_usd: number; costo_insumos_usd: number
  costo_fertilizantes_usd: number; costo_servicios_usd: number; costo_fijos_usd: number
}

type CostoGanaderia = {
  id: string; tipo: string; descripcion: string | null; monto_usd: number
  categoria_id: string | null; campania: string | null
  categorias_hacienda: { nombre: string } | null
}

type FeedlotResumen = {
  ingreso_id: string; campania: string
  categoria: string; cantidad_cabezas: number
  costo_racion_usd: number
  cabezas_vendidas: number; ingreso_ventas_usd: number
}

const inputCls = 'rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'

function fmt(n: number, dec = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function KpiCard({ label, value, sub, color = 'text-stone-900' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ResumenCampaniaPage() {
  const supabase = createClient()
  const [campanias, setCampanias] = useState<Campania[]>([])
  const [campania, setCampania] = useState('')
  const [cargando, setCargando] = useState(false)

  const [verdeos, setVerdeos] = useState<VerdeoLote[]>([])
  const [costos, setCostos] = useState<CostoGanaderia[]>([])
  const [feedlotResumen, setFeedlotResumen] = useState<FeedlotResumen[]>([])
  const [cabezasVendidas, setCabezasVendidas] = useState(0)

  useEffect(() => {
    supabase.from('campanas').select('id, nombre').order('nombre', { ascending: false })
      .then(({ data }) => setCampanias(data ?? []))
  }, [])

  const cargarResumen = async () => {
    if (!campania) return
    setCargando(true)

    // 1. Costos de verdeo de Seguimiento (actividad ganadero)
    const { data: verdeosData } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('ciclo_id, lote, campo, cultivo, hectareas, sup_sembrada, costo_semillas_usd, costo_insumos_usd, costo_fertilizantes_usd, costo_servicios_usd, costo_fijos_usd')
      .eq('campana', campania)
      .eq('actividad', 'ganadero')

    // 2. Costos ganaderos registrados manualmente
    const { data: costosData } = await supabase
      .from('costos_ganaderia')
      .select('*, categorias_hacienda(nombre)')
      .eq('campania', campania)

    // 3. Feedlot: cargas y salidas por campaña
    const { data: ingresosData } = await supabase
      .from('feedlot_ingresos')
      .select('id, campania, cantidad_cabezas, categorias_hacienda(nombre)')
      .eq('campania', campania)

    let feedlotData: FeedlotResumen[] = []
    let totalCabezasVendidas = 0

    if (ingresosData && ingresosData.length > 0) {
      const ingresosIds = ingresosData.map((i: any) => i.id)

      const [{ data: cargasData }, { data: salidasData }] = await Promise.all([
        supabase.from('feedlot_cargas').select('ingreso_id, maiz_tn, maiz_precio_usd_tn, nucleo_tn, nucleo_precio_usd_tn, expeller_tn, expeller_precio_usd_tn, otros_alimentos').in('ingreso_id', ingresosIds),
        supabase.from('feedlot_salidas').select('ingreso_id, cantidad_cabezas, motivo, ingreso_total_usd').in('ingreso_id', ingresosIds),
      ])

      feedlotData = ingresosData.map((ing: any) => {
        const cargasIng = (cargasData ?? []).filter((c: any) => c.ingreso_id === ing.id)
        const salidasIng = (salidasData ?? []).filter((s: any) => s.ingreso_id === ing.id)
        const costoRacion = cargasIng.reduce((s: number, c: any) => {
          const otros = (c.otros_alimentos ?? []).reduce((ss: number, o: any) => ss + o.cantidad_tn * o.precio_usd_tn, 0)
          return s + c.maiz_tn * c.maiz_precio_usd_tn + c.nucleo_tn * c.nucleo_precio_usd_tn + c.expeller_tn * c.expeller_precio_usd_tn + otros
        }, 0)
        const ventasSalidas = salidasIng.filter((s: any) => s.motivo === 'venta')
        const cabVendidas = ventasSalidas.reduce((s: number, x: any) => s + x.cantidad_cabezas, 0)
        const ingresoVentas = ventasSalidas.reduce((s: number, x: any) => s + (x.ingreso_total_usd ?? 0), 0)
        totalCabezasVendidas += cabVendidas
        return {
          ingreso_id: ing.id, campania: ing.campania,
          categoria: (ing as any).categorias_hacienda?.nombre ?? '—',
          cantidad_cabezas: ing.cantidad_cabezas,
          costo_racion_usd: costoRacion,
          cabezas_vendidas: cabVendidas,
          ingreso_ventas_usd: ingresoVentas,
        }
      })
    }

    setVerdeos((verdeosData ?? []) as VerdeoLote[])
    setCostos((costosData ?? []) as CostoGanaderia[])
    setFeedlotResumen(feedlotData)
    setCabezasVendidas(totalCabezasVendidas)
    setCargando(false)
  }

  // Totales verdeo
  const totalVerdeoInsumos = verdeos.reduce((s, v) => s + Number(v.costo_insumos_usd) + Number(v.costo_semillas_usd) + Number(v.costo_fertilizantes_usd), 0)
  const totalVerdeoServicios = verdeos.reduce((s, v) => s + Number(v.costo_servicios_usd), 0)
  const totalVerdeoFijos = verdeos.reduce((s, v) => s + Number(v.costo_fijos_usd), 0)
  const totalVerdeo = totalVerdeoInsumos + totalVerdeoServicios + totalVerdeoFijos

  // Totales costos manuales por tipo
  const costosPorTipo = costos.reduce((acc, c) => {
    acc[c.tipo] = (acc[c.tipo] ?? 0) + c.monto_usd
    return acc
  }, {} as Record<string, number>)
  const totalCostosManual = costos.reduce((s, c) => s + c.monto_usd, 0)

  // Totales feedlot
  const totalRacion = feedlotResumen.reduce((s, f) => s + f.costo_racion_usd, 0)
  const totalVentas = feedlotResumen.reduce((s, f) => s + f.ingreso_ventas_usd, 0)

  // Gran total costos
  const totalCostos = totalVerdeo + totalCostosManual + totalRacion
  const resultado = totalVentas - totalCostos
  const costoPorCabeza = cabezasVendidas > 0 ? totalCostos / cabezasVendidas : 0
  const resultadoPorCabeza = cabezasVendidas > 0 ? resultado / cabezasVendidas : 0

  const TIPO_LABELS: Record<string, string> = {
    sanidad: 'Sanidad', racion: 'Ración', flete: 'Flete', guia_senasa: 'Guía SENASA',
    caravanas: 'Caravanas', arrendamiento: 'Arrendamiento', mano_obra: 'Mano de obra', otro: 'Otro'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Resumen de campaña</h1>
        <p className="text-sm text-stone-500">Costos e ingresos ganaderos consolidados por campaña.</p>
      </div>

      {/* Selector campaña */}
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Campaña</label>
          <select value={campania} onChange={e => setCampania(e.target.value)} className={inputCls}>
            <option value="">Seleccionar campaña...</option>
            {campanias.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <button onClick={cargarResumen} disabled={!campania || cargando}
          className="rounded-md bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
          {cargando ? 'Cargando...' : 'Ver resumen'}
        </button>
      </div>

      {!cargando && campania && (verdeos.length > 0 || costos.length > 0 || feedlotResumen.length > 0) && (
        <div className="space-y-8">

          {/* KPIs principales */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard label="Total costos" value={`USD ${fmt(totalCostos)}`} color="text-red-700" />
            <KpiCard label="Total ventas" value={`USD ${fmt(totalVentas)}`} color="text-green-700" />
            <KpiCard label="Resultado neto" value={`USD ${fmt(resultado)}`}
              color={resultado >= 0 ? 'text-green-700' : 'text-red-700'}
              sub={cabezasVendidas > 0 ? `USD ${fmt(resultadoPorCabeza)}/cab` : undefined} />
            <KpiCard label="Costo por cabeza vendida" value={cabezasVendidas > 0 ? `USD ${fmt(costoPorCabeza)}` : '—'}
              sub={cabezasVendidas > 0 ? `${cabezasVendidas} cabezas vendidas` : 'Sin ventas registradas'} />
          </div>

          {/* Costos de verdeo (Seguimiento Agronómico) */}
          {verdeos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-stone-900">Costos de verdeo / pasturas</h2>
                <span className="text-sm font-medium text-stone-700">USD {fmt(totalVerdeo)}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Campo / Lote</th>
                    <th className="px-4 py-2 font-medium">Cultivo</th>
                    <th className="px-4 py-2 text-right font-medium">Hectáreas</th>
                    <th className="px-4 py-2 text-right font-medium">Insumos USD</th>
                    <th className="px-4 py-2 text-right font-medium">Servicios USD</th>
                    <th className="px-4 py-2 text-right font-medium">Fijos USD</th>
                    <th className="px-4 py-2 text-right font-medium">Total USD</th>
                  </tr></thead>
                  <tbody>
                    {verdeos.map(v => {
                      const insumos = Number(v.costo_insumos_usd) + Number(v.costo_semillas_usd) + Number(v.costo_fertilizantes_usd)
                      const total = insumos + Number(v.costo_servicios_usd) + Number(v.costo_fijos_usd)
                      return (
                        <tr key={v.ciclo_id} className="border-t border-stone-100">
                          <td className="px-4 py-2"><div className="font-medium text-stone-900">{v.campo}</div><div className="text-xs text-stone-500">{v.lote}</div></td>
                          <td className="px-4 py-2 text-stone-700">{v.cultivo}</td>
                          <td className="px-4 py-2 text-right text-stone-600">{fmt(Number(v.hectareas))}</td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(insumos)}</td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(Number(v.costo_servicios_usd))}</td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(Number(v.costo_fijos_usd))}</td>
                          <td className="px-4 py-2 text-right font-medium text-stone-900">USD {fmt(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-stone-900">Total verdeos</td>
                    <td className="px-4 py-2 text-right text-stone-900">USD {fmt(totalVerdeoInsumos)}</td>
                    <td className="px-4 py-2 text-right text-stone-900">USD {fmt(totalVerdeoServicios)}</td>
                    <td className="px-4 py-2 text-right text-stone-900">USD {fmt(totalVerdeoFijos)}</td>
                    <td className="px-4 py-2 text-right text-stone-900">USD {fmt(totalVerdeo)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Feedlot */}
          {feedlotResumen.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-stone-900">Feedlot</h2>
                <span className="text-sm font-medium text-stone-700">Ración: USD {fmt(totalRacion)} · Ventas: USD {fmt(totalVentas)}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Categoría</th>
                    <th className="px-4 py-2 text-right font-medium">Ingresaron</th>
                    <th className="px-4 py-2 text-right font-medium">Vendidas</th>
                    <th className="px-4 py-2 text-right font-medium">Costo ración</th>
                    <th className="px-4 py-2 text-right font-medium">Ingreso ventas</th>
                    <th className="px-4 py-2 text-right font-medium">Resultado</th>
                  </tr></thead>
                  <tbody>
                    {feedlotResumen.map(f => (
                      <tr key={f.ingreso_id} className="border-t border-stone-100">
                        <td className="px-4 py-2 font-medium text-stone-900">{f.categoria}</td>
                        <td className="px-4 py-2 text-right text-stone-700">{f.cantidad_cabezas}</td>
                        <td className="px-4 py-2 text-right text-stone-700">{f.cabezas_vendidas}</td>
                        <td className="px-4 py-2 text-right text-stone-900">USD {fmt(f.costo_racion_usd)}</td>
                        <td className="px-4 py-2 text-right text-green-700">USD {fmt(f.ingreso_ventas_usd)}</td>
                        <td className={`px-4 py-2 text-right font-medium ${f.ingreso_ventas_usd - f.costo_racion_usd >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          USD {fmt(f.ingreso_ventas_usd - f.costo_racion_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Costos ganaderos manuales */}
          {costos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-stone-900">Otros costos ganaderos</h2>
                <span className="text-sm font-medium text-stone-700">USD {fmt(totalCostosManual)}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                    <th className="px-4 py-2 font-medium">Tipo</th>
                    <th className="px-4 py-2 text-right font-medium">Total USD</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(costosPorTipo).sort((a, b) => b[1] - a[1]).map(([tipo, total]) => (
                      <tr key={tipo} className="border-t border-stone-100">
                        <td className="px-4 py-2 text-stone-700">{TIPO_LABELS[tipo] ?? tipo}</td>
                        <td className="px-4 py-2 text-right font-medium text-stone-900">USD {fmt(total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-stone-200 bg-stone-50">
                    <td className="px-4 py-2 font-semibold text-stone-900">Total</td>
                    <td className="px-4 py-2 text-right font-bold text-stone-900">USD {fmt(totalCostosManual)}</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Resumen final */}
          <div className="rounded-lg border-2 border-stone-200 bg-stone-50 p-5">
            <h2 className="text-base font-semibold text-stone-900 mb-4">Resumen campaña {campania}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-600">Costos verdeo / pasturas</span><span className="font-medium text-stone-900">USD {fmt(totalVerdeo)}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Costo ración feedlot</span><span className="font-medium text-stone-900">USD {fmt(totalRacion)}</span></div>
              <div className="flex justify-between"><span className="text-stone-600">Otros costos ganaderos</span><span className="font-medium text-stone-900">USD {fmt(totalCostosManual)}</span></div>
              <div className="flex justify-between border-t border-stone-300 pt-2 mt-2">
                <span className="font-semibold text-stone-900">Total costos</span>
                <span className="font-bold text-red-700">USD {fmt(totalCostos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-stone-900">Ingresos por ventas</span>
                <span className="font-bold text-green-700">USD {fmt(totalVentas)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-stone-400 pt-2 mt-2">
                <span className="font-bold text-stone-900">Resultado neto</span>
                <span className={`font-bold text-lg ${resultado >= 0 ? 'text-green-700' : 'text-red-700'}`}>USD {fmt(resultado)}</span>
              </div>
              {cabezasVendidas > 0 && (
                <div className="flex justify-between text-xs text-stone-500 pt-1">
                  <span>Costo / cabeza vendida ({cabezasVendidas} cab.)</span>
                  <span className="font-medium">USD {fmt(costoPorCabeza)} · Resultado USD {fmt(resultadoPorCabeza)}/cab</span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {!cargando && campania && verdeos.length === 0 && costos.length === 0 && feedlotResumen.length === 0 && (
        <p className="text-sm text-stone-500">No hay datos ganaderos registrados para la campaña {campania}.</p>
      )}
    </div>
  )
}
