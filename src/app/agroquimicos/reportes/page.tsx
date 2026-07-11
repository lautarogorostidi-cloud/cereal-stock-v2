'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Campana = { id: number; nombre: string }

const REPORTES = [
  { id: 'costo_lote',        label: 'Costo por lote/campo',       desc: 'Gasto en agroquímicos por lote en cada campaña' },
  { id: 'costo_cultivo',     label: 'Costo por cultivo',          desc: 'Comparativa de costos entre cultivos' },
  { id: 'evolucion_precio',  label: 'Evolución de precios',       desc: 'Variación del precio de cada producto a lo largo del tiempo' },
  { id: 'tipo_aplicacion',   label: 'Aplicaciones por tipo',      desc: 'Cantidad de aplicaciones por tipo por campaña' },
  { id: 'ranking_productos', label: 'Ranking de productos',       desc: 'Productos más usados por volumen y por costo' },
  { id: 'comparativa',       label: 'Comparativa entre campañas', desc: 'Mismos lotes comparados entre campañas distintas' },
]

export default function ReportesAgroquimicosPage() {
  const supabase = createClient()
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [campanaSeleccionada, setCampanaSeleccionada] = useState<string>('todas')
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [generando, setGenerando] = useState(false)
  const [generandoId, setGenerandoId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setCampanas(data ?? []))
  }, [])

  function toggleReporte(id: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    setSeleccionados(prev =>
      prev.size === REPORTES.length ? new Set() : new Set(REPORTES.map(r => r.id))
    )
  }

  // ── Descarga CSV ──
  function descargarCSV(datos: any[], nombreArchivo: string) {
    if (datos.length === 0) return
    const headers = Object.keys(datos[0])
    const rows = datos.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`))
    const csv = [
      headers.map(h => `"${h}"`).join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Queries ──

  async function getDatosCostoLote() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, costo_servicio_usd_ha, sa_ciclos!inner(campanas!inner(nombre), lotes!inner(nombre, establecimiento), cultivos!inner(nombre)))')
      .limit(10000)
    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const campana = ap.sa_aplicaciones?.sa_ciclos?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const lote = ap.sa_aplicaciones?.sa_ciclos?.lotes?.nombre ?? ''
      const campo = ap.sa_aplicaciones?.sa_ciclos?.lotes?.establecimiento ?? ''
      const cultivo = ap.sa_aplicaciones?.sa_ciclos?.cultivos?.nombre ?? ''
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      const key = `${campana}||${campo}||${lote}||${cultivo}`
      if (!mapa[key]) mapa[key] = { Campaña: campana, Campo: campo, Lote: lote, Cultivo: cultivo, 'Costo Insumos (USD)': 0 }
      mapa[key]['Costo Insumos (USD)'] += Math.round(costoInsumo)
    })
    return Object.values(mapa).sort((a, b) => a.Campaña.localeCompare(b.Campaña) || a.Lote.localeCompare(b.Lote))
  }

  async function getDatosCostoCultivo() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, sa_ciclos!inner(campanas!inner(nombre), cultivos!inner(nombre)))')
      .limit(10000)
    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const campana = ap.sa_aplicaciones?.sa_ciclos?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const cultivo = ap.sa_aplicaciones?.sa_ciclos?.cultivos?.nombre ?? ''
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      const key = `${campana}||${cultivo}`
      if (!mapa[key]) mapa[key] = { Campaña: campana, Cultivo: cultivo, 'Costo Insumos (USD)': 0, 'Superficie (ha)': 0 }
      mapa[key]['Costo Insumos (USD)'] += Math.round(costoInsumo)
      mapa[key]['Superficie (ha)'] += sup
    })
    return Object.values(mapa)
      .map(r => ({ ...r, 'Superficie (ha)': Math.round(r['Superficie (ha)']), 'Costo/ha (USD)': r['Superficie (ha)'] > 0 ? Math.round(r['Costo Insumos (USD)'] / r['Superficie (ha)']) : 0 }))
      .sort((a, b) => a.Campaña.localeCompare(b.Campaña) || a.Cultivo.localeCompare(b.Cultivo))
  }

  async function getDatosEvolucionPrecio() {
    const { data } = await supabase
      .from('agroquimicos_movimientos')
      .select('fecha, cantidad, precio_unitario, agroquimicos_productos!inner(nombre, tipo, unidad)')
      .eq('tipo', 'compra')
      .order('fecha')
    return (data ?? []).map((m: any) => ({
      Fecha: m.fecha,
      Producto: m.agroquimicos_productos?.nombre ?? '',
      Tipo: m.agroquimicos_productos?.tipo ?? '',
      Unidad: m.agroquimicos_productos?.unidad ?? '',
      Cantidad: Number(m.cantidad ?? 0),
      'Precio Unitario (USD)': Number(m.precio_unitario ?? 0),
    }))
  }

  async function getDatosTipoAplicacion() {
    const { data } = await supabase
      .from('sa_aplicaciones')
      .select('tipo, superficie_ha, sa_ciclos!inner(campanas!inner(nombre))')
    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((a: any) => {
      const campana = a.sa_ciclos?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const tipo = a.tipo ?? 'sin tipo'
      const key = `${campana}||${tipo}`
      if (!mapa[key]) mapa[key] = { Campaña: campana, 'Tipo de Aplicación': tipo, 'Cantidad de Aplicaciones': 0, 'Superficie Total (ha)': 0 }
      mapa[key]['Cantidad de Aplicaciones'] += 1
      mapa[key]['Superficie Total (ha)'] += Number(a.superficie_ha ?? 0)
    })
    return Object.values(mapa).sort((a, b) => a.Campaña.localeCompare(b.Campaña))
  }

  async function getDatosRankingProductos() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('producto, dosis_ha, costo_unitario, unidad, sa_aplicaciones!inner(superficie_ha, sa_ciclos!inner(campanas!inner(nombre)))')
      .limit(10000)
    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const campana = ap.sa_aplicaciones?.sa_ciclos?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const prod = ap.producto ?? ''
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const dosis = Number(ap.dosis_ha ?? 0)
      const costo = Number(ap.costo_unitario ?? 0)
      if (!mapa[prod]) mapa[prod] = { Producto: prod, Unidad: ap.unidad ?? 'L', 'Volumen Total': 0, 'Costo Total (USD)': 0 }
      mapa[prod]['Volumen Total'] += dosis * sup
      mapa[prod]['Costo Total (USD)'] += Math.round(costo * dosis * sup)
    })
    return Object.values(mapa)
      .map(r => ({ ...r, 'Volumen Total': Math.round(r['Volumen Total'] * 10) / 10 }))
      .sort((a, b) => b['Costo Total (USD)'] - a['Costo Total (USD)'])
  }

  async function getDatosComparativa() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, sa_ciclos!inner(campanas!inner(nombre), lotes!inner(nombre, establecimiento)))')
      .limit(10000)
    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const campana = ap.sa_aplicaciones?.sa_ciclos?.campanas?.nombre ?? ''
      const lote = ap.sa_aplicaciones?.sa_ciclos?.lotes?.nombre ?? ''
      const campo = ap.sa_aplicaciones?.sa_ciclos?.lotes?.establecimiento ?? ''
      const sup = Number(ap.sa_aplicaciones?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      const key = `${lote}||${campana}`
      if (!mapa[key]) mapa[key] = { Campo: campo, Lote: lote, Campaña: campana, 'Costo Insumos (USD)': 0, 'Superficie (ha)': 0 }
      mapa[key]['Costo Insumos (USD)'] += Math.round(costoInsumo)
      mapa[key]['Superficie (ha)'] += sup
    })
    return Object.values(mapa)
      .map(r => ({ ...r, 'Superficie (ha)': Math.round(r['Superficie (ha)']), 'Costo/ha (USD)': r['Superficie (ha)'] > 0 ? Math.round(r['Costo Insumos (USD)'] / r['Superficie (ha)']) : 0 }))
      .sort((a, b) => a.Lote.localeCompare(b.Lote) || a.Campaña.localeCompare(b.Campaña))
  }

  async function fetchDatos(id: string) {
    switch (id) {
      case 'costo_lote':        return getDatosCostoLote()
      case 'costo_cultivo':     return getDatosCostoCultivo()
      case 'evolucion_precio':  return getDatosEvolucionPrecio()
      case 'tipo_aplicacion':   return getDatosTipoAplicacion()
      case 'ranking_productos': return getDatosRankingProductos()
      case 'comparativa':       return getDatosComparativa()
      default: return []
    }
  }

  async function descargarReporte(id: string) {
    setGenerandoId(id)
    const datos = await fetchDatos(id)
    const reporte = REPORTES.find(r => r.id === id)!
    const sufijo = campanaSeleccionada !== 'todas' ? `_${campanaSeleccionada}` : ''
    descargarCSV(datos.length > 0 ? datos : [{ 'Sin datos': 'No hay datos para el filtro seleccionado' }], `${id}${sufijo}.csv`)
    setGenerandoId(null)
  }

  async function descargarSeleccionados() {
    if (seleccionados.size === 0) return
    setGenerando(true)
    const ids = REPORTES.map(r => r.id).filter(id => seleccionados.has(id))
    for (const id of ids) {
      const datos = await fetchDatos(id)
      const reporte = REPORTES.find(r => r.id === id)!
      const sufijo = campanaSeleccionada !== 'todas' ? `_${campanaSeleccionada}` : ''
      descargarCSV(datos.length > 0 ? datos : [{ 'Sin datos': 'No hay datos' }], `${id}${sufijo}.csv`)
      // Pequeña pausa entre descargas para que el browser no las bloquee
      await new Promise(res => setTimeout(res, 300))
    }
    setGenerando(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Seleccioná los reportes que querés exportar en CSV</p>
      </div>

      {/* Filtro campaña + acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={campanaSeleccionada} onChange={e => setCampanaSeleccionada(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="todas">Todas las campañas</option>
          {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>

        <button onClick={toggleTodos}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-campo-100 text-campo-600 hover:bg-campo-200 transition-colors">
          {seleccionados.size === REPORTES.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
        </button>

        <button onClick={descargarSeleccionados} disabled={seleccionados.size === 0 || generando}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
            ${seleccionados.size > 0 ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-campo-100 text-campo-400 cursor-not-allowed'}`}>
          {generando ? '⏳ Generando...' : `⬇️ Descargar seleccionados${seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}`}
        </button>
      </div>

      {/* Lista de reportes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {REPORTES.map(r => {
          const checked = seleccionados.has(r.id)
          const cargando = generandoId === r.id
          return (
            <div key={r.id}
              onClick={() => toggleReporte(r.id)}
              className={`card p-5 flex items-start gap-4 cursor-pointer transition-all border-2
                ${checked ? 'border-emerald-500 bg-emerald-50/40' : 'border-transparent hover:border-campo-200'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggleReporte(r.id)}
                onClick={e => e.stopPropagation()}
                className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-campo-900">{r.label}</div>
                <div className="text-xs text-campo-500 mt-0.5">{r.desc}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); descargarReporte(r.id) }}
                disabled={cargando}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors disabled:opacity-50">
                {cargando ? '⏳' : '⬇️ CSV'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
