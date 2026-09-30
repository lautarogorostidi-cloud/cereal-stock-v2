'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ResumenCiclo = {
  ciclo_id: number
  campana: string
  cultivo: string
  actividad: string | null
  hectareas: number | null
  sup_sembrada: number | null
  sup_cosechada: number | null
  rinde_kg_total: number | null
  costo_semillas_usd: number | null
  costo_insumos_usd: number | null
  costo_fertilizantes_usd: number | null
  costo_servicios_usd: number | null
  costo_fijos_usd: number | null
}

type FijoSinCiclo = { campana: string; costo_ciclo: number | null }
type Venta = { campania: string; cultivo: string; ingreso_neto_total: number | null }

type FilaCultivo = {
  cultivo: string
  lotes: number
  haSembrada: number
  haCosechada: number
  kg: number
  costoTotal: number
  ingreso: number | null
}

type FilaCampana = {
  campana: string
  lotes: number
  haSembrada: number
  haCosechada: number
  kg: number
  costoTotal: number
  ingreso: number
  cultivos: Record<string, FilaCultivo>
}

async function fetchAll<T>(supabase: ReturnType<typeof createClient>, tabla: string, columnas: string, filtro?: (q: any) => any): Promise<T[]> {
  const pageSize = 1000
  let desde = 0
  let todas: T[] = []
  while (true) {
    let q = supabase.from(tabla).select(columnas).range(desde, desde + pageSize - 1)
    if (filtro) q = filtro(q)
    const { data, error } = await q
    if (error) { console.error(`Error cargando ${tabla}:`, error); break }
    const pagina = (data ?? []) as T[]
    todas = todas.concat(pagina)
    if (pagina.length < pageSize) break
    desde += pageSize
  }
  return todas
}

function descargarCSV(datos: Record<string, any>[], nombreArchivo: string) {
  if (datos.length === 0) return
  const headers = Object.keys(datos[0])
  const rows = datos.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`))
  const csv = [
    headers.map(h => `"${h}"`).join(';'),
    ...rows.map(r => r.join(';')),
  ].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

function BarraEvolucion({ label, valores, formato }: { label: string; valores: { campana: string; valor: number }[]; formato: (n: number) => string }) {
  const max = Math.max(1, ...valores.map(v => v.valor))
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold text-campo-700 mb-3">{label}</div>
      <div className="space-y-2">
        {valores.map(v => (
          <div key={v.campana} className="flex items-center gap-3">
            <div className="w-14 text-xs text-campo-500 shrink-0">{v.campana}</div>
            <div className="flex-1 h-5 bg-campo-100 rounded overflow-hidden">
              <div className="h-full bg-lime-600 rounded" style={{ width: `${v.valor > 0 ? Math.max(3, (v.valor / max) * 100) : 0}%` }} />
            </div>
            <div className="w-24 text-xs text-right font-medium text-campo-900 shrink-0">{v.valor > 0 ? formato(v.valor) : '—'}</div>
          </div>
        ))}
        {valores.length === 0 && <div className="text-xs text-campo-400">Sin datos</div>}
      </div>
    </div>
  )
}

export default function ReportesSeguimientoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filas, setFilas] = useState<FilaCampana[]>([])
  const [expandida, setExpandida] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [resumen, fijosSinCiclo, ventas] = await Promise.all([
        fetchAll<ResumenCiclo>(supabase, 'vw_sa_resumen_ciclo', 'ciclo_id, campana, cultivo, actividad, hectareas, sup_sembrada, sup_cosechada, rinde_kg_total, costo_semillas_usd, costo_insumos_usd, costo_fertilizantes_usd, costo_servicios_usd, costo_fijos_usd'),
        fetchAll<FijoSinCiclo>(supabase, 'vw_distribucion_costos_fijos', 'campana, costo_ciclo', q => q.is('ciclo_id', null)),
        fetchAll<Venta>(supabase, 'vw_resultado_comercial', 'campania, cultivo, ingreso_neto_total'),
      ])

      const ingresoPorCampana: Record<string, number> = {}
      const ingresoPorCampanaCultivo: Record<string, number> = {}
      ventas.forEach(v => {
        const c = v.campania
        const key = `${c}||${v.cultivo}`
        ingresoPorCampana[c] = (ingresoPorCampana[c] ?? 0) + Number(v.ingreso_neto_total ?? 0)
        ingresoPorCampanaCultivo[key] = (ingresoPorCampanaCultivo[key] ?? 0) + Number(v.ingreso_neto_total ?? 0)
      })

      const fijosSinCicloPorCampana: Record<string, number> = {}
      fijosSinCiclo.forEach(f => { fijosSinCicloPorCampana[f.campana] = (fijosSinCicloPorCampana[f.campana] ?? 0) + Number(f.costo_ciclo ?? 0) })

      const acc: Record<string, FilaCampana> = {}
      resumen.forEach(r => {
        if (!acc[r.campana]) acc[r.campana] = { campana: r.campana, lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costoTotal: 0, ingreso: 0, cultivos: {} }
        const fc = acc[r.campana]
        const costoCiclo = Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
          Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) + Number(r.costo_fijos_usd ?? 0)
        const haSemb = Number(r.sup_sembrada ?? r.hectareas ?? 0)
        const haCose = Number(r.sup_cosechada ?? 0)
        const kg = Number(r.rinde_kg_total ?? 0)

        fc.lotes += 1
        fc.haSembrada += haSemb
        fc.haCosechada += haCose
        fc.kg += kg
        fc.costoTotal += costoCiclo

        if (!fc.cultivos[r.cultivo]) fc.cultivos[r.cultivo] = { cultivo: r.cultivo, lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costoTotal: 0, ingreso: null }
        const fcu = fc.cultivos[r.cultivo]
        fcu.lotes += 1
        fcu.haSembrada += haSemb
        fcu.haCosechada += haCose
        fcu.kg += kg
        fcu.costoTotal += costoCiclo
      })

      // Agrega campañas que solo tengan costos fijos sin ciclo o ventas, aunque no tengan
      // ciclos cargados en vw_sa_resumen_ciclo (para que ningún dato quede afuera).
      Object.keys(fijosSinCicloPorCampana).forEach(c => {
        if (!acc[c]) acc[c] = { campana: c, lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costoTotal: 0, ingreso: 0, cultivos: {} }
      })
      Object.keys(ingresoPorCampana).forEach(c => {
        if (!acc[c]) acc[c] = { campana: c, lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costoTotal: 0, ingreso: 0, cultivos: {} }
      })

      Object.values(acc).forEach(fc => {
        fc.costoTotal += fijosSinCicloPorCampana[fc.campana] ?? 0
        fc.ingreso = ingresoPorCampana[fc.campana] ?? 0
        Object.values(fc.cultivos).forEach(fcu => {
          const key = `${fc.campana}||${fcu.cultivo}`
          fcu.ingreso = key in ingresoPorCampanaCultivo ? ingresoPorCampanaCultivo[key] : null
        })
      })

      const filasOrdenadas = Object.values(acc).sort((a, b) => a.campana.localeCompare(b.campana))
      setFilas(filasOrdenadas)
      setLoading(false)
    }
    cargar()
  }, [])

  const fmt = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtEntero = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtUsd = (n: number) => `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const datosComparativa = filas.map(f => ({
    Campaña: f.campana,
    Lotes: f.lotes,
    'Ha Sembradas': Math.round(f.haSembrada),
    'Ha Cosechadas': Math.round(f.haCosechada),
    'Producción (tn)': Math.round(f.kg / 100) / 10,
    'Rinde (kg/ha)': f.haCosechada > 0 ? Math.round(f.kg / f.haCosechada) : '',
    'Costo Total (USD)': Math.round(f.costoTotal),
    'Costo/ha (USD)': f.haSembrada > 0 ? Math.round(f.costoTotal / f.haSembrada) : '',
    'Ingreso Ventas (USD)': f.ingreso > 0 ? Math.round(f.ingreso) : '',
    'Margen (USD)': f.ingreso > 0 ? Math.round(f.ingreso - f.costoTotal) : '',
    'Margen/ha (USD)': f.ingreso > 0 && f.haSembrada > 0 ? Math.round((f.ingreso - f.costoTotal) / f.haSembrada) : '',
  }))

  const datosPorCultivo = filas.flatMap(f =>
    Object.values(f.cultivos).sort((a, b) => b.haSembrada - a.haSembrada).map(c => ({
      Campaña: f.campana,
      Cultivo: c.cultivo,
      Lotes: c.lotes,
      'Ha Sembradas': Math.round(c.haSembrada),
      'Ha Cosechadas': Math.round(c.haCosechada),
      'Producción (tn)': Math.round(c.kg / 100) / 10,
      'Rinde (kg/ha)': c.haCosechada > 0 ? Math.round(c.kg / c.haCosechada) : '',
      'Costo Total (USD)': Math.round(c.costoTotal),
      'Costo/ha (USD)': c.haSembrada > 0 ? Math.round(c.costoTotal / c.haSembrada) : '',
      'Ingreso Ventas (USD)': c.ingreso != null ? Math.round(c.ingreso) : '',
    }))
  )

  const evolucionRinde = filas.map(f => ({ campana: f.campana, valor: f.haCosechada > 0 ? f.kg / f.haCosechada : 0 }))
  const evolucionCostoHa = filas.map(f => ({ campana: f.campana, valor: f.haSembrada > 0 ? f.costoTotal / f.haSembrada : 0 }))

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Reportes — Comparativa entre Campañas</h1>
          <p className="text-campo-500 text-sm mt-0.5">Evolución de superficie, rinde, costos y margen a lo largo de las campañas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => descargarCSV(datosComparativa, 'comparativa_campanas.csv')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors">
            ⬇️ CSV comparativa
          </button>
          <button onClick={() => descargarCSV(datosPorCultivo, 'comparativa_campanas_por_cultivo.csv')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-campo-100 text-campo-700 hover:bg-campo-200 transition-colors">
            ⬇️ CSV por cultivo
          </button>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="card p-12 text-center text-campo-400">Todavía no hay ciclos cargados para armar la comparativa.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarraEvolucion label="Evolución del Rinde (kg/ha)" valores={evolucionRinde} formato={fmtEntero} />
            <BarraEvolucion label="Evolución del Costo/ha (USD)" valores={evolucionCostoHa} formato={fmtUsd} />
          </div>

          <div className="card overflow-hidden p-0">
            <div className="px-5 py-4 border-b border-campo-100">
              <h2 className="font-semibold text-campo-900">Comparativa entre Campañas</h2>
              <p className="text-xs text-campo-400 mt-0.5">Clic en una fila para ver el detalle por cultivo · Margen requiere ventas cargadas en Comercialización</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-campo-100 bg-campo-50">
                    <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Lotes</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha Sembradas</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha Cosechadas</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Producción (tn)</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde (kg/ha)</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo Total</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo/ha</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Ingreso Ventas</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Margen</th>
                    <th className="text-right px-5 py-3 font-semibold text-campo-700">Margen/ha</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => {
                    const activa = expandida === f.campana
                    const rinde = f.haCosechada > 0 ? f.kg / f.haCosechada : null
                    const costoHa = f.haSembrada > 0 ? f.costoTotal / f.haSembrada : null
                    const tieneVentas = f.ingreso > 0
                    const margen = tieneVentas ? f.ingreso - f.costoTotal : null
                    const margenHa = margen != null && f.haSembrada > 0 ? margen / f.haSembrada : null
                    return (
                      <Fragment key={f.campana}>
                        <tr onClick={() => setExpandida(activa ? null : f.campana)}
                          className={`border-b border-campo-50 cursor-pointer transition-colors ${activa ? 'bg-lime-50' : 'hover:bg-campo-50/50'}`}>
                          <td className="px-5 py-3 font-medium text-campo-900">{f.campana}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{f.lotes}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{fmt(f.haSembrada)}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{f.haCosechada > 0 ? fmt(f.haCosechada) : '—'}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{f.kg > 0 ? fmt(f.kg / 1000) : '—'}</td>
                          <td className="px-5 py-3 text-right font-medium text-campo-900">{rinde != null ? fmtEntero(rinde) : '—'}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{fmtUsd(f.costoTotal)}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{costoHa != null ? fmtUsd(costoHa) : '—'}</td>
                          <td className="px-5 py-3 text-right text-campo-700">{tieneVentas ? fmtUsd(f.ingreso) : '—'}</td>
                          <td className={`px-5 py-3 text-right font-medium ${margen != null && margen < 0 ? 'text-red-600' : 'text-campo-900'}`}>
                            {margen != null ? fmtUsd(margen) : '—'}
                          </td>
                          <td className={`px-5 py-3 text-right ${margenHa != null && margenHa < 0 ? 'text-red-500' : 'text-campo-700'}`}>
                            {margenHa != null ? fmtUsd(margenHa) : '—'}
                          </td>
                        </tr>
                        {activa && (
                          <tr>
                            <td colSpan={11} className="px-5 py-4 bg-lime-50/50">
                              <div className="text-xs text-campo-500 mb-2">Detalle por cultivo — {f.campana}:</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs bg-white rounded-lg border border-campo-100">
                                  <thead>
                                    <tr className="border-b border-campo-100 bg-campo-50">
                                      <th className="text-left px-3 py-2 font-semibold text-campo-700">Cultivo</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Lotes</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Ha Sembr.</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Ha Cosech.</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Rinde kg/ha</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Costo Total</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Costo/ha</th>
                                      <th className="text-right px-3 py-2 font-semibold text-campo-700">Ingreso Ventas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.values(f.cultivos).sort((a, b) => b.haSembrada - a.haSembrada).map(c => (
                                      <tr key={c.cultivo} className="border-b border-campo-50">
                                        <td className="px-3 py-2 font-medium text-campo-900">{c.cultivo}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{c.lotes}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{fmt(c.haSembrada)}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{c.haCosechada > 0 ? fmt(c.haCosechada) : '—'}</td>
                                        <td className="px-3 py-2 text-right font-medium text-campo-900">{c.haCosechada > 0 ? fmtEntero(c.kg / c.haCosechada) : '—'}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{fmtUsd(c.costoTotal)}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{c.haSembrada > 0 ? fmtUsd(c.costoTotal / c.haSembrada) : '—'}</td>
                                        <td className="px-3 py-2 text-right text-campo-700">{c.ingreso != null ? fmtUsd(c.ingreso) : '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
