'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Fila = {
  fecha: string | null
  mes: string
  campana: string | null
  categoria: string
  subcategoria: string | null
  concepto: string | null
  campo: string | null
  lote: string | null
  cultivo: string | null
  proveedor: string | null
  monto_usd: number
  tipo_fecha: 'real' | 'estimada' | 'sin_fecha'
  estado: string | null
  fuente: string
}

type Dimension = 'categoria' | 'campo' | 'campana' | 'cultivo'

const DIM_LABEL: Record<Dimension, string> = {
  categoria: 'Categoría de costo',
  campo: 'Campo',
  campana: 'Campaña',
  cultivo: 'Cultivo',
}

const SIN_FECHA = 'Sin fecha'
const SIN_ASIGNAR = '(sin asignar)'

type Nodo = {
  clave: string
  total: number
  porMes: Record<string, number>
  hijos: Map<string, Nodo>
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
  const csv = [headers.map(h => `"${h}"`).join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

function valorDim(f: Fila, dim: Dimension): string {
  return (f[dim] as string | null) || SIN_ASIGNAR
}

// Segundo nivel: si agrupo por categoría, abro por subcategoría; si agrupo por otra cosa, abro por categoría
function valorHijo(f: Fila, dim: Dimension): string {
  if (dim === 'categoria') return f.subcategoria || SIN_ASIGNAR
  return f.categoria
}

function nombreMes(m: string): string {
  if (m === SIN_FECHA) return SIN_FECHA
  const [y, mm] = m.split('-')
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${nombres[Number(mm) - 1]} ${y.slice(2)}`
}

function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function rangoMeses(desde: string, hasta: string): string[] {
  const res: string[] = []
  let [y, m] = desde.split('-').map(Number)
  const [yh, mh] = hasta.split('-').map(Number)
  while (y < yh || (y === yh && m <= mh)) {
    res.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return res
}

export default function FlujoDeFondosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filas, setFilas] = useState<Fila[]>([])

  const [filtroCampana, setFiltroCampana] = useState('')
  const [filtroCampo, setFiltroCampo] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('')
  const [dim, setDim] = useState<Dimension>('categoria')
  const [incluirSinFecha, setIncluirSinFecha] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [seleccion, setSeleccion] = useState<{ k1: string; k2?: string; mes?: string } | null>(null)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const data = await fetchAll<Fila>(
        supabase, 'vw_flujo_fondos',
        'fecha, mes, campana, categoria, subcategoria, concepto, campo, lote, cultivo, proveedor, monto_usd, tipo_fecha, estado, fuente'
      )
      setFilas(data.map(f => ({ ...f, monto_usd: Number(f.monto_usd ?? 0) })))
      setLoading(false)
    }
    cargar()
  }, [])

  const campanas = useMemo(() => Array.from(new Set(filas.map(f => f.campana || SIN_ASIGNAR))).sort(), [filas])
  const campos = useMemo(() => Array.from(new Set(filas.map(f => f.campo || SIN_ASIGNAR))).sort(), [filas])
  const anios = useMemo(() => Array.from(new Set(filas.filter(f => f.fecha).map(f => f.mes.slice(0, 4)))).sort(), [filas])

  const filtradas = useMemo(() => filas.filter(f => {
    if (filtroCampana && (f.campana || SIN_ASIGNAR) !== filtroCampana) return false
    if (filtroCampo && (f.campo || SIN_ASIGNAR) !== filtroCampo) return false
    if (filtroAnio && f.fecha && f.mes.slice(0, 4) !== filtroAnio) return false
    if (filtroAnio && !f.fecha) return false
    if (!incluirSinFecha && !f.fecha) return false
    return true
  }), [filas, filtroCampana, filtroCampo, filtroAnio, incluirSinFecha])

  // Columnas de meses (continuas entre el primero y el último) + "Sin fecha"
  const meses = useMemo(() => {
    const conFecha = filtradas.filter(f => f.fecha).map(f => f.mes).sort()
    const cols = conFecha.length > 0 ? rangoMeses(conFecha[0], conFecha[conFecha.length - 1]) : []
    if (filtradas.some(f => !f.fecha)) cols.push(SIN_FECHA)
    return cols
  }, [filtradas])

  const arbol = useMemo(() => {
    const raiz = new Map<string, Nodo>()
    const nuevo = (clave: string): Nodo => ({ clave, total: 0, porMes: {}, hijos: new Map() })
    filtradas.forEach(f => {
      const k1 = valorDim(f, dim)
      const k2 = valorHijo(f, dim)
      const mes = f.fecha ? f.mes : SIN_FECHA
      if (!raiz.has(k1)) raiz.set(k1, nuevo(k1))
      const n1 = raiz.get(k1)!
      if (!n1.hijos.has(k2)) n1.hijos.set(k2, nuevo(k2))
      const n2 = n1.hijos.get(k2)!
      for (const n of [n1, n2]) {
        n.total += f.monto_usd
        n.porMes[mes] = (n.porMes[mes] ?? 0) + f.monto_usd
      }
    })
    return Array.from(raiz.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [filtradas, dim])

  const totalPorMes = useMemo(() => {
    const t: Record<string, number> = {}
    filtradas.forEach(f => {
      const mes = f.fecha ? f.mes : SIN_FECHA
      t[mes] = (t[mes] ?? 0) + f.monto_usd
    })
    return t
  }, [filtradas])

  const totalGeneral = filtradas.reduce((a, f) => a + f.monto_usd, 0)
  const hoyMes = mesActual()
  const totalFuturo = filtradas.filter(f => f.fecha && f.mes > hoyMes).reduce((a, f) => a + f.monto_usd, 0)

  const detalle = useMemo(() => {
    if (!seleccion) return []
    return filtradas
      .filter(f => {
        if (valorDim(f, dim) !== seleccion.k1) return false
        if (seleccion.k2 && valorHijo(f, dim) !== seleccion.k2) return false
        if (seleccion.mes && (f.fecha ? f.mes : SIN_FECHA) !== seleccion.mes) return false
        return true
      })
      .sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999'))
  }, [seleccion, filtradas, dim])

  const fmt = (n: number) => Math.round(n).toLocaleString('es-AR')
  const fmtUsd = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
  const fmtFecha = (f: string | null) => (f ? f.split('-').reverse().join('/') : 'Sin fecha')

  function toggle(clave: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      if (s.has(clave)) s.delete(clave); else s.add(clave)
      return s
    })
  }

  function celda(valor: number | undefined, onClick: () => void, activa: boolean, negrita = false) {
    if (!valor) return <td className="px-2 py-1.5 text-right text-campo-300">·</td>
    return (
      <td
        onClick={onClick}
        className={`px-2 py-1.5 text-right cursor-pointer hover:bg-lime-50 ${valor < 0 ? 'text-red-600' : 'text-campo-800'} ${negrita ? 'font-semibold' : ''} ${activa ? 'bg-lime-100' : ''}`}
      >
        {fmt(valor)}
      </td>
    )
  }

  const hayFiltros = filtroCampana || filtroCampo || filtroAnio || !incluirSinFecha

  function exportarResumen() {
    const filasCSV: Record<string, any>[] = []
    arbol.forEach(n1 => {
      const base: Record<string, any> = { [DIM_LABEL[dim]]: n1.clave, Detalle: '(total)' }
      meses.forEach(m => { base[nombreMes(m)] = Math.round(n1.porMes[m] ?? 0) })
      base['Total'] = Math.round(n1.total)
      filasCSV.push(base)
      Array.from(n1.hijos.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).forEach(n2 => {
        const r: Record<string, any> = { [DIM_LABEL[dim]]: n1.clave, Detalle: n2.clave }
        meses.forEach(m => { r[nombreMes(m)] = Math.round(n2.porMes[m] ?? 0) })
        r['Total'] = Math.round(n2.total)
        filasCSV.push(r)
      })
    })
    descargarCSV(filasCSV, 'flujo_de_fondos_resumen.csv')
  }

  function exportarDetalle() {
    descargarCSV(
      [...filtradas].sort((a, b) => (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999')).map(f => ({
        Fecha: f.fecha ?? 'Sin fecha',
        Mes: f.fecha ? f.mes : SIN_FECHA,
        Campaña: f.campana ?? '',
        Categoría: f.categoria,
        Subcategoría: f.subcategoria ?? '',
        Concepto: f.concepto ?? '',
        Campo: f.campo ?? '',
        Lote: f.lote ?? '',
        Cultivo: f.cultivo ?? '',
        Proveedor: f.proveedor ?? '',
        'Monto (USD)': f.monto_usd,
        'Tipo de fecha': f.tipo_fecha,
        Estado: f.estado ?? '',
        Fuente: f.fuente,
      })),
      'flujo_de_fondos_detalle.csv'
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Flujo de fondos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Todos los costos cargados en la app, mes a mes y a qué se atribuye cada uno (USD)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportarResumen}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors">
            ⬇️ CSV resumen
          </button>
          <button onClick={exportarDetalle}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-emerald-700 text-emerald-800 hover:bg-emerald-50 transition-colors">
            ⬇️ CSV detalle
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-campo-600 mb-1">Ver por</label>
          <select value={dim} onChange={e => { setDim(e.target.value as Dimension); setExpandidos(new Set()); setSeleccion(null) }}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            {(Object.keys(DIM_LABEL) as Dimension[]).map(d => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-campo-600 mb-1">Campaña</label>
          <select value={filtroCampana} onChange={e => { setFiltroCampana(e.target.value); setSeleccion(null) }}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Todas</option>
            {campanas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-campo-600 mb-1">Campo</label>
          <select value={filtroCampo} onChange={e => { setFiltroCampo(e.target.value); setSeleccion(null) }}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Todos</option>
            {campos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-campo-600 mb-1">Año</label>
          <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setSeleccion(null) }}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400">
            <option value="">Todos</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-campo-700 pb-1.5">
          <input type="checkbox" checked={incluirSinFecha} onChange={e => { setIncluirSinFecha(e.target.checked); setSeleccion(null) }} />
          Incluir costos sin fecha
        </label>
        {hayFiltros && (
          <button onClick={() => { setFiltroCampana(''); setFiltroCampo(''); setFiltroAnio(''); setIncluirSinFecha(true); setSeleccion(null) }}
            className="text-xs text-campo-500 hover:text-campo-800 underline pb-2">
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xl">
        <div className="card p-4">
          <div className="text-xs text-campo-500">Total del período</div>
          <div className="text-xl font-bold text-campo-900">{fmtUsd(totalGeneral)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-campo-500">Meses futuros (a vencer)</div>
          <div className="text-xl font-bold text-campo-900">{fmtUsd(totalFuturo)}</div>
        </div>
      </div>

      {meses.length === 0 ? (
        <div className="card p-12 text-center text-campo-400">No hay costos para los filtros elegidos.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="bg-campo-50 text-campo-600">
                <th className="sticky left-0 z-10 bg-campo-50 text-left px-3 py-2 font-semibold min-w-[220px]">{DIM_LABEL[dim]}</th>
                {meses.map(m => (
                  <th key={m} className={`px-2 py-2 text-right font-semibold whitespace-nowrap ${m === SIN_FECHA ? 'text-amber-700 bg-amber-50' : m > hoyMes ? 'text-sky-700 bg-sky-50' : ''}`}>
                    {nombreMes(m)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold bg-campo-100 text-campo-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {arbol.map(n1 => {
                const abierto = expandidos.has(n1.clave)
                const hijos = Array.from(n1.hijos.values()).sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                return (
                  <Fragment key={n1.clave}>
                    <tr className="border-t border-campo-100 bg-white hover:bg-campo-50/50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-semibold text-campo-900 whitespace-nowrap">
                        <button onClick={() => toggle(n1.clave)} className="mr-1.5 text-campo-400 hover:text-campo-800 w-4 inline-block">{abierto ? '▾' : '▸'}</button>
                        <span className="cursor-pointer" onClick={() => setSeleccion({ k1: n1.clave })}>{n1.clave}</span>
                      </td>
                      {meses.map(m => celda(n1.porMes[m], () => setSeleccion({ k1: n1.clave, mes: m }),
                        seleccion?.k1 === n1.clave && !seleccion.k2 && seleccion.mes === m, true))}
                      <td className="px-3 py-1.5 text-right font-bold bg-campo-50 text-campo-900">{fmt(n1.total)}</td>
                    </tr>
                    {abierto && hijos.map(n2 => (
                      <tr key={n1.clave + '|' + n2.clave} className="border-t border-campo-50 bg-campo-50/30">
                        <td className="sticky left-0 z-10 bg-[#f8faf5] pl-9 pr-3 py-1 text-campo-600 whitespace-nowrap cursor-pointer"
                          onClick={() => setSeleccion({ k1: n1.clave, k2: n2.clave })}>
                          {n2.clave}
                        </td>
                        {meses.map(m => celda(n2.porMes[m], () => setSeleccion({ k1: n1.clave, k2: n2.clave, mes: m }),
                          seleccion?.k1 === n1.clave && seleccion.k2 === n2.clave && seleccion.mes === m))}
                        <td className="px-3 py-1 text-right text-campo-700 bg-campo-50">{fmt(n2.total)}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              <tr className="border-t-2 border-campo-300 bg-campo-100 font-bold text-campo-900">
                <td className="sticky left-0 z-10 bg-campo-100 px-3 py-2">TOTAL</td>
                {meses.map(m => <td key={m} className="px-2 py-2 text-right">{totalPorMes[m] ? fmt(totalPorMes[m]) : '·'}</td>)}
                <td className="px-3 py-2 text-right">{fmt(totalGeneral)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-campo-400">
        Tocá una celda, un nombre o un total para ver a qué se atribuye cada costo. Los meses en azul son futuros (vencimientos a pagar). Los montos marcados con * en el detalle tienen fecha estimada: arrendamiento y asesor de las campañas viejas siguen el calendario de pagos de la campaña de referencia del mismo campo, los seguros van a la fecha de siembra del lote, la indemnización a la de cosecha y las fertilizaciones sin fecha a la siembra. Si algo no se puede estimar, queda en la columna “Sin fecha”.
      </p>

      {seleccion && (
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="font-semibold text-campo-900">
                {seleccion.k1}{seleccion.k2 ? ` › ${seleccion.k2}` : ''}{seleccion.mes ? ` — ${nombreMes(seleccion.mes)}` : ''}
              </h2>
              <p className="text-xs text-campo-500">{detalle.length} movimientos · {fmtUsd(detalle.reduce((a, f) => a + f.monto_usd, 0))}</p>
            </div>
            <button onClick={() => setSeleccion(null)} className="text-xs text-campo-500 hover:text-campo-800 underline">Cerrar detalle</button>
          </div>
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-campo-500 text-left">
                  <th className="py-1.5 pr-3 font-medium">Fecha</th>
                  <th className="py-1.5 pr-3 font-medium">Categoría</th>
                  <th className="py-1.5 pr-3 font-medium">Concepto</th>
                  <th className="py-1.5 pr-3 font-medium">Campaña</th>
                  <th className="py-1.5 pr-3 font-medium">Campo</th>
                  <th className="py-1.5 pr-3 font-medium">Lote</th>
                  <th className="py-1.5 pr-3 font-medium">Cultivo</th>
                  <th className="py-1.5 pr-3 font-medium">Proveedor</th>
                  <th className="py-1.5 pr-3 font-medium">Estado</th>
                  <th className="py-1.5 font-medium text-right">USD</th>
                </tr>
              </thead>
              <tbody>
                {detalle.map((f, i) => (
                  <tr key={i} className="border-t border-campo-50 align-top">
                    <td className="py-1 pr-3 whitespace-nowrap text-campo-700">
                      {fmtFecha(f.fecha)}{f.tipo_fecha === 'estimada' && <span className="text-amber-600" title="Fecha estimada"> *</span>}
                    </td>
                    <td className="py-1 pr-3 text-campo-700">{f.categoria}<span className="text-campo-400"> · {f.subcategoria}</span></td>
                    <td className="py-1 pr-3 text-campo-900">{f.concepto}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.campana ?? '—'}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.campo ?? '—'}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.lote ?? '—'}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.cultivo ?? '—'}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.proveedor ?? '—'}</td>
                    <td className="py-1 pr-3 text-campo-700">{f.estado ?? '—'}</td>
                    <td className={`py-1 text-right font-medium ${f.monto_usd < 0 ? 'text-red-600' : 'text-campo-900'}`}>{fmt(f.monto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
