'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type CampaniaDisponible = { nombre: string }

const inputCls = 'rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'

function fmt(n: number, dec = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function Fila({ label, valor, color = 'text-stone-900', bold = false }: { label: string; valor: string; color?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? 'border-t border-stone-300 mt-1 pt-2.5' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-stone-900' : 'text-stone-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${color}`}>{valor}</span>
    </div>
  )
}

export default function ResumenCampaniaPage() {
  const supabase = createClient()
  const [campanias, setCampanias] = useState<string[]>([])
  const [campania, setCampania] = useState('')
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState<any>(null)

  useEffect(() => {
    const cargar = async () => {
      const results = await Promise.all([
        supabase.from('vw_sa_resumen_ciclo').select('campana').eq('actividad', 'ganadero'),
        supabase.from('costos_ganaderia').select('campania').not('campania', 'is', null),
        supabase.from('feedlot_ingresos').select('campania'),
        supabase.from('sanidad_hacienda').select('campania_id, campanas(nombre)'),
      ])
      const nombres = new Set<string>()
      results[0].data?.forEach((r: any) => nombres.add(r.campana))
      results[1].data?.forEach((r: any) => nombres.add(r.campania))
      results[2].data?.forEach((r: any) => nombres.add(r.campania))
      results[3].data?.forEach((r: any) => { if (r.campanas?.nombre) nombres.add(r.campanas.nombre) })
      setCampanias(Array.from(nombres).sort((a, b) => b.localeCompare(a)))
    }
    cargar()
  }, [])

  const cargarResumen = async () => {
    if (!campania) return
    setCargando(true)

    // 1. Verdeos de Seguimiento
    const { data: verdeosData } = await supabase
      .from('vw_sa_resumen_ciclo')
      .select('ciclo_id, lote, campo, cultivo, hectareas, costo_semillas_usd, costo_insumos_usd, costo_fertilizantes_usd, costo_servicios_usd, costo_fijos_usd')
      .eq('campana', campania)
      .eq('actividad', 'ganadero')

    // 2. Costos ganaderos manuales
    const { data: costosData } = await supabase
      .from('costos_ganaderia')
      .select('tipo, monto_usd')
      .eq('campania', campania)

    // 3. Sanidad con monto
    const { data: campaniaData } = await supabase
      .from('campanas')
      .select('id')
      .eq('nombre', campania)
      .single()

    let totalSanidad = 0
    if (campaniaData) {
      const { data: sanidadData } = await supabase
        .from('sanidad_hacienda')
        .select('monto_usd')
        .eq('campania_id', campaniaData.id)
      totalSanidad = (sanidadData ?? []).reduce((s: number, x: any) => s + (x.monto_usd ?? 0), 0)
    }

    // 4. Feedlot
    const { data: ingresosData } = await supabase
      .from('feedlot_ingresos')
      .select('id, cantidad_cabezas, categorias_hacienda(nombre)')
      .eq('campania', campania)

    let totalRacion = 0
    let totalVentasFeedlot = 0
    let totalCabezasVendidas = 0
    let feedlotDetalle: any[] = []

    if (ingresosData && ingresosData.length > 0) {
      const ids = ingresosData.map((i: any) => i.id)
      const [{ data: cargasData }, { data: salidasData }] = await Promise.all([
        supabase.from('feedlot_cargas').select('ingreso_id, maiz_tn, maiz_precio_usd_tn, nucleo_tn, nucleo_precio_usd_tn, expeller_tn, expeller_precio_usd_tn, otros_alimentos').in('ingreso_id', ids),
        supabase.from('feedlot_salidas').select('ingreso_id, cantidad_cabezas, motivo, ingreso_total_usd').in('ingreso_id', ids),
      ])

      feedlotDetalle = ingresosData.map((ing: any) => {
        const cargas = (cargasData ?? []).filter((c: any) => c.ingreso_id === ing.id)
        const salidas = (salidasData ?? []).filter((s: any) => s.ingreso_id === ing.id)
        const costoRacion = cargas.reduce((s: number, c: any) => {
          const otros = (c.otros_alimentos ?? []).reduce((ss: number, o: any) => ss + o.cantidad_tn * o.precio_usd_tn, 0)
          return s + c.maiz_tn * c.maiz_precio_usd_tn + c.nucleo_tn * c.nucleo_precio_usd_tn + c.expeller_tn * c.expeller_precio_usd_tn + otros
        }, 0)
        const ventas = salidas.filter((s: any) => s.motivo === 'venta')
        const cabVendidas = ventas.reduce((s: number, x: any) => s + x.cantidad_cabezas, 0)
        const ingresoVentas = ventas.reduce((s: number, x: any) => s + (x.ingreso_total_usd ?? 0), 0)
        totalRacion += costoRacion
        totalVentasFeedlot += ingresoVentas
        totalCabezasVendidas += cabVendidas
        return { categoria: ing.categorias_hacienda?.nombre, cantidad_cabezas: ing.cantidad_cabezas, cabVendidas, costoRacion, ingresoVentas }
      })
    }

    // Totales verdeo
    const verdeos = (verdeosData ?? [])
    const totalVerdeoInsumos = verdeos.reduce((s: number, v: any) => s + Number(v.costo_insumos_usd) + Number(v.costo_semillas_usd) + Number(v.costo_fertilizantes_usd), 0)
    const totalVerdeoServicios = verdeos.reduce((s: number, v: any) => s + Number(v.costo_servicios_usd), 0)
    const totalVerdeoFijos = verdeos.reduce((s: number, v: any) => s + Number(v.costo_fijos_usd), 0)
    const totalVerdeo = totalVerdeoInsumos + totalVerdeoServicios + totalVerdeoFijos

    // Totales costos manuales por tipo
    const costos = (costosData ?? [])
    const costosPorTipo = costos.reduce((acc: any, c: any) => { acc[c.tipo] = (acc[c.tipo] ?? 0) + c.monto_usd; return acc }, {})
    const totalCostosManual = costos.reduce((s: number, c: any) => s + c.monto_usd, 0)

    const totalCostos = totalVerdeo + totalSanidad + totalRacion + totalCostosManual
    const totalIngresos = totalVentasFeedlot
    const margen = totalIngresos - totalCostos

    setDatos({
      verdeos, totalVerdeo, totalVerdeoInsumos, totalVerdeoServicios, totalVerdeoFijos,
      totalSanidad, totalRacion, costosPorTipo, totalCostosManual,
      totalCostos, totalIngresos, totalVentasFeedlot, totalCabezasVendidas,
      margen, feedlotDetalle,
    })
    setCargando(false)
  }

  const TIPO_LABELS: Record<string, string> = {
    sanidad: 'Sanidad', racion: 'Ración', flete: 'Flete', guia_senasa: 'Guía SENASA',
    caravanas: 'Caravanas', arrendamiento: 'Arrendamiento', mano_obra: 'Mano de obra', otro: 'Otro'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Resumen de campaña</h1>
        <p className="text-sm text-stone-500">Todos los costos e ingresos ganaderos consolidados por campaña.</p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Campaña</label>
          <select value={campania} onChange={e => setCampania(e.target.value)} className={inputCls}>
            <option value="">Seleccionar campaña...</option>
            {campanias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={cargarResumen} disabled={!campania || cargando}
          className="rounded-md bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50">
          {cargando ? 'Cargando...' : 'Ver resumen'}
        </button>
      </div>

      {!cargando && campania && !datos && (
        <p className="text-sm text-stone-500">No hay datos ganaderos para la campaña {campania}.</p>
      )}

      {datos && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

          {/* Columna izquierda: detalles */}
          <div className="space-y-6">

            {/* Verdeos */}
            {datos.verdeos.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-stone-900 mb-3">Verdeos y pasturas <span className="text-sm font-normal text-stone-500">(Seguimiento Agronómico)</span></h2>
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-2 font-medium">Campo / Lote</th>
                      <th className="px-4 py-2 font-medium">Cultivo</th>
                      <th className="px-4 py-2 text-right font-medium">Insumos</th>
                      <th className="px-4 py-2 text-right font-medium">Servicios</th>
                      <th className="px-4 py-2 text-right font-medium">Fijos</th>
                      <th className="px-4 py-2 text-right font-medium">Total USD</th>
                    </tr></thead>
                    <tbody>
                      {datos.verdeos.map((v: any) => {
                        const ins = Number(v.costo_insumos_usd) + Number(v.costo_semillas_usd) + Number(v.costo_fertilizantes_usd)
                        const tot = ins + Number(v.costo_servicios_usd) + Number(v.costo_fijos_usd)
                        return (
                          <tr key={v.ciclo_id} className="border-t border-stone-100">
                            <td className="px-4 py-2"><div className="font-medium text-stone-900">{v.campo}</div><div className="text-xs text-stone-500">{v.lote}</div></td>
                            <td className="px-4 py-2 text-stone-700">{v.cultivo}</td>
                            <td className="px-4 py-2 text-right text-stone-900">{fmt(ins)}</td>
                            <td className="px-4 py-2 text-right text-stone-900">{fmt(Number(v.costo_servicios_usd))}</td>
                            <td className="px-4 py-2 text-right text-stone-900">{fmt(Number(v.costo_fijos_usd))}</td>
                            <td className="px-4 py-2 text-right font-medium text-stone-900">USD {fmt(tot)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                      <td colSpan={2} className="px-4 py-2">Total verdeos</td>
                      <td className="px-4 py-2 text-right">USD {fmt(datos.totalVerdeoInsumos)}</td>
                      <td className="px-4 py-2 text-right">USD {fmt(datos.totalVerdeoServicios)}</td>
                      <td className="px-4 py-2 text-right">USD {fmt(datos.totalVerdeoFijos)}</td>
                      <td className="px-4 py-2 text-right">USD {fmt(datos.totalVerdeo)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Feedlot */}
            {datos.feedlotDetalle.length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-stone-900 mb-3">Feedlot</h2>
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
                      {datos.feedlotDetalle.map((f: any, i: number) => (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-4 py-2 font-medium text-stone-900">{f.categoria}</td>
                          <td className="px-4 py-2 text-right text-stone-700">{f.cantidad_cabezas}</td>
                          <td className="px-4 py-2 text-right text-stone-700">{f.cabVendidas}</td>
                          <td className="px-4 py-2 text-right text-stone-900">USD {fmt(f.costoRacion)}</td>
                          <td className="px-4 py-2 text-right text-green-700">USD {fmt(f.ingresoVentas)}</td>
                          <td className={`px-4 py-2 text-right font-medium ${f.ingresoVentas - f.costoRacion >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            USD {fmt(f.ingresoVentas - f.costoRacion)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Costos manuales */}
            {Object.keys(datos.costosPorTipo).length > 0 && (
              <div>
                <h2 className="text-base font-semibold text-stone-900 mb-3">Otros costos ganaderos</h2>
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 text-right font-medium">Total USD</th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(datos.costosPorTipo).sort((a: any, b: any) => b[1] - a[1]).map(([tipo, total]: any) => (
                        <tr key={tipo} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-stone-700">{TIPO_LABELS[tipo] ?? tipo}</td>
                          <td className="px-4 py-2 text-right font-medium text-stone-900">USD {fmt(total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-stone-200 bg-stone-50">
                      <td className="px-4 py-2 font-semibold text-stone-900">Total</td>
                      <td className="px-4 py-2 text-right font-bold text-stone-900">USD {fmt(datos.totalCostosManual)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: resumen final */}
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-stone-200 bg-white p-5 sticky top-6">
              <h2 className="text-base font-bold text-stone-900 mb-4">Campaña {campania}</h2>

              <div className="space-y-0.5 mb-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Costos</p>
                <Fila label="Verdeos / pasturas" valor={`USD ${fmt(datos.totalVerdeo)}`} />
                <Fila label="Sanidad" valor={`USD ${fmt(datos.totalSanidad)}`} />
                <Fila label="Ración feedlot" valor={`USD ${fmt(datos.totalRacion)}`} />
                {Object.entries(datos.costosPorTipo).map(([tipo, total]: any) => (
                  <Fila key={tipo} label={TIPO_LABELS[tipo] ?? tipo} valor={`USD ${fmt(total)}`} />
                ))}
                <Fila label="TOTAL COSTOS" valor={`USD ${fmt(datos.totalCostos)}`} color="text-red-700" bold />
              </div>

              <div className="space-y-0.5 mb-4">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Ingresos</p>
                <Fila label="Ventas de hacienda" valor={`USD ${fmt(datos.totalVentasFeedlot)}`} color="text-green-700" />
                <Fila label="TOTAL INGRESOS" valor={`USD ${fmt(datos.totalIngresos)}`} color="text-green-700" bold />
              </div>

              <div className="rounded-lg p-4 mt-4 ${datos.margen >= 0 ? 'bg-green-50' : 'bg-red-50'}">
                <p className="text-xs text-stone-500 mb-1">Margen neto</p>
                <p className={`text-2xl font-bold ${datos.margen >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  USD {fmt(datos.margen)}
                </p>
                {datos.totalCabezasVendidas > 0 && (
                  <p className="text-xs text-stone-500 mt-1">
                    USD {fmt(datos.margen / datos.totalCabezasVendidas)} / cabeza vendida ({datos.totalCabezasVendidas} cab.)
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
