'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'

type ResumenCiclo = {
  ciclo_id: number
  campana: string
  cultivo: string
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

type FilaCampanaCultivo = {
  campana: string
  lotes: number
  haSembrada: number
  haCosechada: number
  kg: number
  costoTotal: number
}

// Un ciclo (lote + campaña + cultivo) con lo necesario para agrupar por híbrido/variedad
type CicloReporte = {
  cultivo: string
  campana: string
  hibridoKey: string
  hibridoLabel: string
  mezcla: boolean
  haSemb: number
  haCose: number
  kg: number
  costo: number
}

type FilaHibrido = {
  key: string
  label: string
  mezcla: boolean
  lotes: number
  haSemb: number
  haCose: number
  kg: number
  costo: number
  costoCosechado: number
  porCampana: Record<string, { haCose: number; kg: number }>
}

const normalizar = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()

type Cultivo = {
  cultivo: string
  haSembradaTotal: number
  porCampana: FilaCampanaCultivo[]
}

async function fetchAll<T>(supabase: ReturnType<typeof createClient>, tabla: string, columnas: string): Promise<T[]> {
  const pageSize = 1000
  let desde = 0
  let todas: T[] = []
  while (true) {
    const { data, error } = await supabase.from(tabla).select(columnas).range(desde, desde + pageSize - 1)
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

// Barra horizontal simple por campaña, para ver la evolución de un indicador
// (costo/ha, rinde) sin mezclar cultivos distintos entre sí.
function BarraEvolucion({ valores, formato }: { valores: { campana: string; valor: number; haSembrada: number }[]; formato: (n: number) => string }) {
  const max = Math.max(1, ...valores.map(v => v.valor))
  return (
    <div className="space-y-2">
      {valores.map(v => (
        <div key={v.campana} className="flex items-center gap-3">
          <div className="w-24 text-xs text-campo-500 shrink-0">{v.campana} <span className="text-campo-400">({Math.round(v.haSembrada)} ha)</span></div>
          <div className="flex-1 h-5 bg-campo-100 rounded overflow-hidden">
            <div className="h-full bg-lime-600 rounded" style={{ width: `${v.valor > 0 ? Math.max(3, (v.valor / max) * 100) : 0}%` }} />
          </div>
          <div className="w-24 text-xs text-right font-medium text-campo-900 shrink-0">{v.valor > 0 ? formato(v.valor) : '—'}</div>
        </div>
      ))}
      {valores.length === 0 && <div className="text-xs text-campo-400">Sin datos</div>}
    </div>
  )
}

export default function ReportesSeguimientoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [campaniasSel, setCampaniasSel] = useState<string[]>([]) // vacío = todas
  const [ciclos, setCiclos] = useState<CicloReporte[]>([])
  const [abiertos, setAbiertos] = useState<string[]>([])

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const resumen = await fetchAll<ResumenCiclo>(
        supabase, 'vw_sa_resumen_ciclo',
        'ciclo_id, campana, cultivo, hectareas, sup_sembrada, sup_cosechada, rinde_kg_total, costo_semillas_usd, costo_insumos_usd, costo_fertilizantes_usd, costo_servicios_usd, costo_fijos_usd'
      )

      // híbridos/variedades cargados en la siembra de cada ciclo (hasta 3 por siembra)
      const { data: siembras } = await fetchAllRows<{ ciclo_id: number; hibrido_1: string | null; hibrido_2: string | null; hibrido_3: string | null }>(
        () => supabase.from('sa_siembras').select('ciclo_id, hibrido_1, hibrido_2, hibrido_3').order('id')
      )
      const hibridosPorCiclo = new Map<number, Map<string, string>>() // ciclo -> (clave normalizada -> nombre)
      siembras.forEach(sm => {
        const m = hibridosPorCiclo.get(sm.ciclo_id) ?? new Map<string, string>()
        ;[sm.hibrido_1, sm.hibrido_2, sm.hibrido_3].forEach(h => {
          if (h && h.trim()) { const k = normalizar(h); if (!m.has(k)) m.set(k, h.trim()) }
        })
        hibridosPorCiclo.set(sm.ciclo_id, m)
      })
      const listaCiclos: CicloReporte[] = []

      // cultivo -> campaña -> acumulado
      const acc: Record<string, Record<string, FilaCampanaCultivo>> = {}
      resumen.forEach(r => {
        const costoCiclo = Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
          Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) + Number(r.costo_fijos_usd ?? 0)
        const haSemb = Number(r.sup_sembrada ?? r.hectareas ?? 0)
        const haCose = Number(r.sup_cosechada ?? 0)
        const kg = Number(r.rinde_kg_total ?? 0)

        const hib = Array.from((hibridosPorCiclo.get(r.ciclo_id) ?? new Map<string, string>()).entries()).sort((a, b) => a[0].localeCompare(b[0]))
        listaCiclos.push({
          cultivo: r.cultivo,
          campana: r.campana,
          hibridoKey: hib.length === 0 ? '__sin__' : hib.map(h => h[0]).join('|'),
          hibridoLabel: hib.length === 0 ? 'Sin híbrido/variedad cargado' : hib.length === 1 ? hib[0][1] : 'Mezcla: ' + hib.map(h => h[1]).join(' + '),
          mezcla: hib.length > 1,
          haSemb, haCose, kg, costo: costoCiclo,
        })

        if (!acc[r.cultivo]) acc[r.cultivo] = {}
        if (!acc[r.cultivo][r.campana]) acc[r.cultivo][r.campana] = { campana: r.campana, lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costoTotal: 0 }
        const fila = acc[r.cultivo][r.campana]
        fila.lotes += 1
        fila.haSembrada += haSemb
        fila.haCosechada += haCose
        fila.kg += kg
        fila.costoTotal += costoCiclo
      })

      const lista: Cultivo[] = Object.entries(acc).map(([cultivo, porCampanaMap]) => {
        const porCampana = Object.values(porCampanaMap).sort((a, b) => a.campana.localeCompare(b.campana))
        const haSembradaTotal = porCampana.reduce((acc, f) => acc + f.haSembrada, 0)
        return { cultivo, haSembradaTotal, porCampana }
      }).sort((a, b) => b.haSembradaTotal - a.haSembradaTotal)

      setCultivos(lista)
      setCiclos(listaCiclos)
      setLoading(false)
    }
    cargar()
  }, [])

  const fmt = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtEntero = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtUsd = (n: number) => `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const campaniasDisponibles = useMemo(
    () => Array.from(new Set(cultivos.flatMap(c => c.porCampana.map(f => f.campana)))).sort().reverse(),
    [cultivos]
  )

  function toggleCampania(c: string) {
    setCampaniasSel(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleAbierto(cultivo: string) {
    setAbiertos(prev => prev.includes(cultivo) ? prev.filter(x => x !== cultivo) : [...prev, cultivo])
  }

  // Rinde por híbrido/variedad de cada cultivo, respetando el filtro de campañas.
  // La cosecha se carga por lote, no por híbrido: si un lote tiene 2 o más híbridos
  // sembrados, su rinde queda en una fila "Mezcla" en vez de repartirlo.
  const hibridosPorCultivo = useMemo(() => {
    const out: Record<string, FilaHibrido[]> = {}
    ciclos.forEach(c => {
      if (campaniasSel.length > 0 && !campaniasSel.includes(c.campana)) return
      const lista = out[c.cultivo] ?? (out[c.cultivo] = [])
      let f = lista.find(x => x.key === c.hibridoKey)
      if (!f) { f = { key: c.hibridoKey, label: c.hibridoLabel, mezcla: c.mezcla, lotes: 0, haSemb: 0, haCose: 0, kg: 0, costo: 0, costoCosechado: 0, porCampana: {} }; lista.push(f) }
      f.lotes += 1
      f.haSemb += c.haSemb
      f.haCose += c.haCose
      f.kg += c.kg
      f.costo += c.costo
      if (c.kg > 0) f.costoCosechado += c.costo
      const pc = f.porCampana[c.campana] ?? (f.porCampana[c.campana] = { haCose: 0, kg: 0 })
      pc.haCose += c.haCose
      pc.kg += c.kg
    })
    Object.values(out).forEach(l => l.sort((a, b) => b.haSemb - a.haSemb))
    return out
  }, [ciclos, campaniasSel])

  // Cultivos con solo las campañas elegidas (vacío = todas). Se recalcula el total de ha para el orden.
  const cultivosVista = useMemo(() => {
    if (campaniasSel.length === 0) return cultivos
    return cultivos
      .map(c => {
        const porCampana = c.porCampana.filter(f => campaniasSel.includes(f.campana))
        return { ...c, porCampana, haSembradaTotal: porCampana.reduce((a, f) => a + f.haSembrada, 0) }
      })
      .filter(c => c.porCampana.length > 0)
      .sort((a, b) => b.haSembradaTotal - a.haSembradaTotal)
  }, [cultivos, campaniasSel])

  const datosCSV = cultivosVista.flatMap(c =>
    c.porCampana.map(f => ({
      Cultivo: c.cultivo,
      Campaña: f.campana,
      Lotes: f.lotes,
      'Ha Sembradas': Math.round(f.haSembrada),
      'Ha Cosechadas': Math.round(f.haCosechada),
      'Producción (tn)': Math.round(f.kg / 100) / 10,
      'Rinde (kg/ha)': f.haCosechada > 0 ? Math.round(f.kg / f.haCosechada) : '',
      'Costo Total (USD)': Math.round(f.costoTotal),
      'Costo/ha (USD)': f.haSembrada > 0 ? Math.round(f.costoTotal / f.haSembrada) : '',
      'Precio Indiferencia Neto (USD/tn)': f.kg > 0 ? Math.round(f.costoTotal / (f.kg / 1000)) : '',
    }))
  )

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Reportes — Evolución por Cultivo</h1>
          <p className="text-campo-500 text-sm mt-0.5">Costo/ha, rinde y precio de indiferencia neto de cada cultivo, comparados entre campañas</p>
          <p className="text-campo-400 text-xs mt-1">Precio de indiferencia NETO = Costo Total ÷ Producción — es lo que necesitás cobrar neto, en el bolsillo, por tonelada, para que el margen dé cero. No es el precio bruto/FOB que figura en el contrato: de ese precio bruto todavía se descuentan flete y comisión de venta antes de que te llegue el neto, así que el precio a pactar tiene que ser mayor a este.</p>
        </div>
        <button onClick={() => descargarCSV(datosCSV, 'evolucion_por_cultivo.csv')}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors">
          ⬇️ CSV
        </button>
      </div>

      <div className="card p-4">
        <label className="block text-xs font-medium text-campo-600 mb-1">Campañas {campaniasSel.length === 0 && <span className="text-campo-400 font-normal">(todas)</span>}</label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setCampaniasSel([])}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${campaniasSel.length === 0 ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-campo-200 text-campo-700 hover:bg-campo-50'}`}>
            Todas
          </button>
          {campaniasDisponibles.map(c => (
            <button key={c} type="button" onClick={() => toggleCampania(c)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${campaniasSel.includes(c) ? 'bg-emerald-700 border-emerald-700 text-white' : 'bg-white border-campo-200 text-campo-700 hover:bg-campo-50'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {cultivosVista.length === 0 ? (
        <div className="card p-12 text-center text-campo-400">{cultivos.length === 0 ? 'Todavía no hay ciclos cargados para armar la evolución.' : 'No hay ciclos en las campañas seleccionadas.'}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cultivosVista.map(c => {
            const evolucionCostoHa = c.porCampana.map(f => ({ campana: f.campana, valor: f.haSembrada > 0 ? f.costoTotal / f.haSembrada : 0, haSembrada: f.haSembrada }))
            const evolucionRinde = c.porCampana.map(f => ({ campana: f.campana, valor: f.haCosechada > 0 ? f.kg / f.haCosechada : 0, haSembrada: f.haSembrada }))
            const evolucionPrecioIndif = c.porCampana.map(f => ({ campana: f.campana, valor: f.kg > 0 ? f.costoTotal / (f.kg / 1000) : 0, haSembrada: f.haSembrada }))
            return (
              <div key={c.cultivo} className="card p-5">
                <button type="button" onClick={() => toggleAbierto(c.cultivo)}
                  className="w-full flex items-center justify-between gap-3 text-left mb-4">
                  <h2 className="font-semibold text-campo-900">{c.cultivo}</h2>
                  <span className="text-xs text-emerald-700 font-medium shrink-0">
                    {abiertos.includes(c.cultivo) ? '▲ Ocultar rinde por híbrido / variedad' : '▼ Ver rinde por híbrido / variedad'}
                  </span>
                </button>
                {abiertos.includes(c.cultivo) && (
                  <div className="mb-5 rounded-lg border border-campo-200 bg-campo-50/40 p-3 overflow-x-auto">
                    <div className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-2">Por híbrido / variedad</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-campo-500">
                          <th className="text-left py-1 font-medium">Híbrido / variedad</th>
                          <th className="text-right py-1 font-medium">Lotes</th>
                          <th className="text-right py-1 font-medium">Ha Semb.</th>
                          <th className="text-right py-1 font-medium">Ha Cosech.</th>
                          <th className="text-right py-1 font-medium">Prod. (tn)</th>
                          <th className="text-right py-1 font-medium">Rinde (kg/ha)</th>
                          <th className="text-left py-1 pl-4 font-medium">Rinde por campaña</th>
                          <th className="text-right py-1 font-medium">Costo/ha</th>
                          <th className="text-right py-1 font-medium">Precio Indif. (USD/tn)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(hibridosPorCultivo[c.cultivo] ?? []).map(h => (
                          <tr key={h.key} className="border-t border-campo-100">
                            <td className="py-1.5 font-medium text-campo-900">{h.label}</td>
                            <td className="py-1.5 text-right text-campo-700">{h.lotes}</td>
                            <td className="py-1.5 text-right text-campo-700">{fmt(h.haSemb)}</td>
                            <td className="py-1.5 text-right text-campo-700">{h.haCose > 0 ? fmt(h.haCose) : '—'}</td>
                            <td className="py-1.5 text-right text-campo-700">{h.kg > 0 ? fmt(h.kg / 1000) : '—'}</td>
                            <td className="py-1.5 text-right font-semibold text-campo-900">{h.haCose > 0 && h.kg > 0 ? fmtEntero(h.kg / h.haCose) : '—'}</td>
                            <td className="py-1.5 pl-4 text-campo-600 whitespace-nowrap">
                              {Object.entries(h.porCampana).filter(([, v]) => v.kg > 0 && v.haCose > 0).sort((a, b) => b[0].localeCompare(a[0]))
                                .map(([camp, v]) => `${camp}: ${fmtEntero(v.kg / v.haCose)}`).join(' · ') || '—'}
                            </td>
                            <td className="py-1.5 text-right text-campo-700">{h.haSemb > 0 ? fmtUsd(h.costo / h.haSemb) : '—'}</td>
                            <td className="py-1.5 text-right text-campo-700">{h.kg > 0 ? fmtUsd(h.costoCosechado / (h.kg / 1000)) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(hibridosPorCultivo[c.cultivo] ?? []).some(h => h.mezcla) && (
                      <p className="text-xs text-campo-400 mt-2">La cosecha se carga por lote, no por híbrido. Los lotes sembrados con 2 o más híbridos se muestran juntos como "Mezcla" porque no se puede separar el rinde de cada uno.</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-2">Costo/ha (USD)</div>
                    <BarraEvolucion valores={evolucionCostoHa} formato={fmtUsd} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-2">Rinde (kg/ha)</div>
                    <BarraEvolucion valores={evolucionRinde} formato={fmtEntero} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-campo-500 uppercase tracking-wide mb-2">Precio de Indiferencia Neto (USD/tn)</div>
                    <BarraEvolucion valores={evolucionPrecioIndif} formato={fmtUsd} />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-campo-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-campo-500">
                        <th className="text-left py-1 font-medium">Campaña</th>
                        <th className="text-right py-1 font-medium">Lotes</th>
                        <th className="text-right py-1 font-medium">Ha Semb.</th>
                        <th className="text-right py-1 font-medium">Ha Cosech.</th>
                        <th className="text-right py-1 font-medium">Prod. (tn)</th>
                        <th className="text-right py-1 font-medium">Costo Total</th>
                        <th className="text-right py-1 font-medium">Precio Indif. Neto (USD/tn)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.porCampana.map(f => (
                        <tr key={f.campana} className="border-t border-campo-50">
                          <td className="py-1.5 font-medium text-campo-900">{f.campana}</td>
                          <td className="py-1.5 text-right text-campo-700">{f.lotes}</td>
                          <td className="py-1.5 text-right text-campo-700">{fmt(f.haSembrada)}</td>
                          <td className="py-1.5 text-right text-campo-700">{f.haCosechada > 0 ? fmt(f.haCosechada) : '—'}</td>
                          <td className="py-1.5 text-right text-campo-700">{f.kg > 0 ? fmt(f.kg / 1000) : '—'}</td>
                          <td className="py-1.5 text-right text-campo-700">{fmtUsd(f.costoTotal)}</td>
                          <td className="py-1.5 text-right font-medium text-campo-900">{f.kg > 0 ? fmtUsd(f.costoTotal / (f.kg / 1000)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
