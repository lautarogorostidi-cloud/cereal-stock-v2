'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const resumen = await fetchAll<ResumenCiclo>(
        supabase, 'vw_sa_resumen_ciclo',
        'ciclo_id, campana, cultivo, hectareas, sup_sembrada, sup_cosechada, rinde_kg_total, costo_semillas_usd, costo_insumos_usd, costo_fertilizantes_usd, costo_servicios_usd, costo_fijos_usd'
      )

      // cultivo -> campaña -> acumulado
      const acc: Record<string, Record<string, FilaCampanaCultivo>> = {}
      resumen.forEach(r => {
        const costoCiclo = Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
          Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) + Number(r.costo_fijos_usd ?? 0)
        const haSemb = Number(r.sup_sembrada ?? r.hectareas ?? 0)
        const haCose = Number(r.sup_cosechada ?? 0)
        const kg = Number(r.rinde_kg_total ?? 0)

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
      setLoading(false)
    }
    cargar()
  }, [])

  const fmt = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtEntero = (n: number) => Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const fmtUsd = (n: number) => `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const datosCSV = cultivos.flatMap(c =>
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

      {cultivos.length === 0 ? (
        <div className="card p-12 text-center text-campo-400">Todavía no hay ciclos cargados para armar la evolución.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cultivos.map(c => {
            const evolucionCostoHa = c.porCampana.map(f => ({ campana: f.campana, valor: f.haSembrada > 0 ? f.costoTotal / f.haSembrada : 0, haSembrada: f.haSembrada }))
            const evolucionRinde = c.porCampana.map(f => ({ campana: f.campana, valor: f.haCosechada > 0 ? f.kg / f.haCosechada : 0, haSembrada: f.haSembrada }))
            const evolucionPrecioIndif = c.porCampana.map(f => ({ campana: f.campana, valor: f.kg > 0 ? f.costoTotal / (f.kg / 1000) : 0, haSembrada: f.haSembrada }))
            return (
              <div key={c.cultivo} className="card p-5">
                <h2 className="font-semibold text-campo-900 mb-4">{c.cultivo}</h2>
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
