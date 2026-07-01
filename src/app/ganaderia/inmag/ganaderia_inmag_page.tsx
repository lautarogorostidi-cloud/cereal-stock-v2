'use client'

import { useState } from 'react'

type FilaMAG = {
  fecha: string
  cabezas: number
  importe: number
  indice: number | null
  faltaCerrar: boolean
}

type ResumenMAG = {
  totalCabezas: number
  totalImporte: number
  precioPorCabeza: number
  indicePonderado: number | null
  pesoPromedio: number | null
}

function formatearParaAPI(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

const inputCls = 'rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-stone-500 focus:outline-none'

function fmt(n: number, dec = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export default function InmagPage() {
  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const ultimoDia = hoy.toISOString().slice(0, 10)

  const [desde, setDesde] = useState(primerDia)
  const [hasta, setHasta] = useState(ultimoDia)
  const [cargando, setCargando] = useState(false)
  const [filas, setFilas] = useState<FilaMAG[] | null>(null)
  const [resumen, setResumen] = useState<ResumenMAG | null>(null)
  const [error, setError] = useState<string | null>(null)

  const buscar = async () => {
    if (!desde || !hasta) return
    setCargando(true); setError(null); setFilas(null); setResumen(null)
    try {
      const res = await fetch(`/api/inmag?desde=${formatearParaAPI(desde)}&hasta=${formatearParaAPI(hasta)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al obtener datos.')
      setFilas(json.filas)
      setResumen(json.resumen)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">INMAG — Índice de Arrendamiento</h1>
        <p className="text-sm text-stone-500">
          Datos del Mercado Agroganadero · Cabezas ingresadas, importe, índice y peso promedio por período.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-stone-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Fecha desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Fecha hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde} className={inputCls} />
        </div>
        <button
          onClick={buscar}
          disabled={cargando || !desde || !hasta}
          className="rounded-md bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          {cargando ? 'Consultando...' : 'Consultar'}
        </button>
        <a
          href="https://www.mercadoagroganadero.com.ar/dll/hacienda2.dll/haciinfo000013"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-stone-400 underline hover:text-stone-600"
        >
          Ver en mercadoagroganadero.com.ar ↗
        </a>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {resumen && filas && (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 mb-1">Cabezas ingresadas</p>
              <p className="text-xl font-bold text-stone-900">{fmt(resumen.totalCabezas)}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 mb-1">Importe total ($)</p>
              <p className="text-xl font-bold text-stone-900">{fmt(resumen.totalImporte)}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 mb-1">Precio por cabeza ($)</p>
              <p className="text-xl font-bold text-stone-900">{fmt(resumen.precioPorCabeza)}</p>
              <p className="text-xs text-stone-400 mt-0.5">Importe ÷ Cabezas</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 mb-1">Índice ponderado</p>
              {resumen.indicePonderado !== null
                ? <p className="text-xl font-bold text-amber-700">{fmt(resumen.indicePonderado, 3)}</p>
                : <p className="text-sm text-stone-400 italic mt-1">Falta cerrar</p>}
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs text-stone-500 mb-1">Peso promedio (kg)</p>
              {resumen.pesoPromedio !== null
                ? <p className="text-xl font-bold text-green-700">{fmt(resumen.pesoPromedio, 1)} kg</p>
                : <p className="text-sm text-stone-400 italic mt-1">Falta cerrar</p>}
              <p className="text-xs text-stone-400 mt-0.5">Precio/cab ÷ Índice</p>
            </div>
          </div>

          {/* Tabla detalle por día */}
          {filas.length > 0 && (
            <div>
              <h2 className="mb-3 text-base font-semibold text-stone-900">Detalle por día</h2>
              <div className="overflow-hidden rounded-lg border border-stone-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-2 font-medium">Fecha</th>
                      <th className="px-4 py-2 text-right font-medium">Cab. ingresadas</th>
                      <th className="px-4 py-2 text-right font-medium">Importe ($)</th>
                      <th className="px-4 py-2 text-right font-medium">Índice arrendamiento</th>
                      <th className="px-4 py-2 text-right font-medium">Precio / cab ($)</th>
                      <th className="px-4 py-2 text-right font-medium">Peso prom. (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => {
                      const precioCab = f.cabezas > 0 ? f.importe / f.cabezas : 0
                      const peso = f.indice && precioCab > 0 ? precioCab / f.indice : null
                      return (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-stone-700">{f.fecha}</td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(f.cabezas)}</td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(f.importe)}</td>
                          <td className="px-4 py-2 text-right">
                            {f.faltaCerrar
                              ? <span className="text-xs italic text-stone-400">Falta cerrar</span>
                              : <span className="text-amber-700 font-medium">{fmt(f.indice!, 3)}</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-stone-900">{fmt(precioCab)}</td>
                          <td className="px-4 py-2 text-right">
                            {peso !== null
                              ? <span className="font-medium text-green-700">{fmt(peso, 1)} kg</span>
                              : <span className="text-xs italic text-stone-400">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 bg-stone-50 font-semibold">
                      <td className="px-4 py-2 text-stone-900">Totales / Prom.</td>
                      <td className="px-4 py-2 text-right text-stone-900">{fmt(resumen.totalCabezas)}</td>
                      <td className="px-4 py-2 text-right text-stone-900">{fmt(resumen.totalImporte)}</td>
                      <td className="px-4 py-2 text-right text-amber-700">
                        {resumen.indicePonderado !== null ? fmt(resumen.indicePonderado, 3) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-stone-900">{fmt(resumen.precioPorCabeza)}</td>
                      <td className="px-4 py-2 text-right text-green-700">
                        {resumen.pesoPromedio !== null ? `${fmt(resumen.pesoPromedio, 1)} kg` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {!cargando && !filas && !error && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 py-16 text-center">
          <p className="text-stone-400 text-sm">Seleccioná un período y hacé clic en Consultar</p>
        </div>
      )}
    </div>
  )
}
