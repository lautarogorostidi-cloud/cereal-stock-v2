'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

type Campana = { id: number; nombre: string }

const REPORTES = [
  { id: 'costo_lote',       label: 'Costo por lote/campo',         desc: 'Gasto en agroquímicos por lote en cada campaña' },
  { id: 'costo_cultivo',    label: 'Costo por cultivo',            desc: 'Comparativa de costos entre cultivos' },
  { id: 'evolucion_precio', label: 'Evolución de precios',         desc: 'Variación del precio de cada producto a lo largo del tiempo' },
  { id: 'tipo_aplicacion',  label: 'Aplicaciones por tipo',        desc: 'Cantidad de aplicaciones por tipo (herbicida, fungicida, insecticida) por campaña' },
  { id: 'ranking_productos',label: 'Ranking de productos',         desc: 'Productos más usados por volumen y por costo' },
  { id: 'comparativa',      label: 'Comparativa entre campañas',   desc: 'Mismos lotes comparados entre campañas distintas' },
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

  // ── Queries de datos ──

  async function getDatosCostoLote() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, costo_servicio_usd_ha, sa_ciclos!inner(campanas!inner(nombre), lotes!inner(nombre, establecimiento), cultivos!inner(nombre)))')
    
    const rows: any[] = []
    ;(data ?? []).forEach((ap: any) => {
      const apl = ap.sa_aplicaciones
      const ciclo = apl?.sa_ciclos
      const campana = ciclo?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const lote = ciclo?.lotes?.nombre ?? ''
      const campo = ciclo?.lotes?.establecimiento ?? ''
      const cultivo = ciclo?.cultivos?.nombre ?? ''
      const sup = Number(apl?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      rows.push({ Campaña: campana, Campo: campo, Lote: lote, Cultivo: cultivo, 'Costo Insumos (USD)': Math.round(costoInsumo) })
    })

    // Agrupar por campaña + lote
    const mapa: Record<string, any> = {}
    rows.forEach(r => {
      const key = `${r.Campaña}||${r.Campo}||${r.Lote}||${r.Cultivo}`
      if (!mapa[key]) mapa[key] = { Campaña: r.Campaña, Campo: r.Campo, Lote: r.Lote, Cultivo: r.Cultivo, 'Costo Insumos (USD)': 0 }
      mapa[key]['Costo Insumos (USD)'] += r['Costo Insumos (USD)']
    })
    return Object.values(mapa).sort((a, b) => a.Campaña.localeCompare(b.Campaña) || a.Lote.localeCompare(b.Lote))
  }

  async function getDatosCostoCultivo() {
    const { data } = await supabase
      .from('sa_aplicacion_productos')
      .select('producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, costo_servicio_usd_ha, sa_ciclos!inner(campanas!inner(nombre), cultivos!inner(nombre)))')

    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const apl = ap.sa_aplicaciones
      const ciclo = apl?.sa_ciclos
      const campana = ciclo?.campanas?.nombre ?? ''
      if (campanaSeleccionada !== 'todas' && campana !== campanaSeleccionada) return
      const cultivo = ciclo?.cultivos?.nombre ?? ''
      const sup = Number(apl?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      const key = `${campana}||${cultivo}`
      if (!mapa[key]) mapa[key] = { Campaña: campana, Cultivo: cultivo, 'Costo Insumos (USD)': 0, 'Superficie (ha)': 0 }
      mapa[key]['Costo Insumos (USD)'] += Math.round(costoInsumo)
      mapa[key]['Superficie (ha)'] += sup
    })

    return Object.values(mapa)
      .map(r => ({ ...r, 'Costo/ha (USD)': r['Superficie (ha)'] > 0 ? Math.round(r['Costo Insumos (USD)'] / r['Superficie (ha)']) : 0 }))
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
      .select('producto, dosis_ha, costo_unitario, sa_aplicaciones!inner(superficie_ha, costo_servicio_usd_ha, sa_ciclos!inner(campanas!inner(nombre), lotes!inner(nombre, establecimiento)))' )

    const mapa: Record<string, any> = {}
    ;(data ?? []).forEach((ap: any) => {
      const apl = ap.sa_aplicaciones
      const ciclo = apl?.sa_ciclos
      const campana = ciclo?.campanas?.nombre ?? ''
      const lote = ciclo?.lotes?.nombre ?? ''
      const campo = ciclo?.lotes?.establecimiento ?? ''
      const sup = Number(apl?.superficie_ha ?? 0)
      const costoInsumo = Number(ap.costo_unitario ?? 0) * Number(ap.dosis_ha ?? 0) * sup
      const key = `${lote}||${campana}`
      if (!mapa[key]) mapa[key] = { Campo: campo, Lote: lote, Campaña: campana, 'Costo Insumos (USD)': 0, 'Superficie (ha)': 0 }
      mapa[key]['Costo Insumos (USD)'] += Math.round(costoInsumo)
      mapa[key]['Superficie (ha)'] += sup
    })

    return Object.values(mapa)
      .map(r => ({ ...r, 'Costo/ha (USD)': r['Superficie (ha)'] > 0 ? Math.round(r['Costo Insumos (USD)'] / r['Superficie (ha)']) : 0 }))
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

  function crearHoja(wb: XLSX.WorkBook, datos: any[], nombreHoja: string) {
    const ws = XLSX.utils.json_to_sheet(datos)
    // Ancho automático de columnas
    const cols = datos.length > 0 ? Object.keys(datos[0]).map(k => ({ wch: Math.max(k.length, 14) })) : []
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, nombreHoja)
  }

  async function descargarReporte(id: string) {
    setGenerandoId(id)
    const datos = await fetchDatos(id)
    const reporte = REPORTES.find(r => r.id === id)!
    const wb = XLSX.utils.book_new()
    crearHoja(wb, datos.length > 0 ? datos : [{ 'Sin datos': 'No hay datos para el filtro seleccionado' }], reporte.label.slice(0, 31))
    const sufijo = campanaSeleccionada !== 'todas' ? `_${campanaSeleccionada}` : ''
    XLSX.writeFile(wb, `reporte_${id}${sufijo}.xlsx`)
    setGenerandoId(null)
  }

  async function descargarSeleccionados() {
    if (seleccionados.size === 0) return
    setGenerando(true)
    const wb = XLSX.utils.book_new()
    for (const id of REPORTES.map(r => r.id).filter(id => seleccionados.has(id))) {
      const reporte = REPORTES.find(r => r.id === id)!
      const datos = await fetchDatos(id)
      crearHoja(wb, datos.length > 0 ? datos : [{ 'Sin datos': 'No hay datos para el filtro seleccionado' }], reporte.label.slice(0, 31))
    }
    const sufijo = campanaSeleccionada !== 'todas' ? `_${campanaSeleccionada}` : ''
    XLSX.writeFile(wb, `reportes_agroquimicos${sufijo}.xlsx`)
    setGenerando(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes Agroquímicos</h1>
        <p className="text-campo-500 text-sm mt-0.5">Seleccioná los reportes que querés exportar</p>
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

        <button
          onClick={descargarSeleccionados}
          disabled={seleccionados.size === 0 || generando}
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
              className={`card p-5 flex items-start gap-4 cursor-pointer transition-all border-2
                ${checked ? 'border-emerald-500 bg-emerald-50/40' : 'border-transparent hover:border-campo-200'}`}
              onClick={() => toggleReporte(r.id)}>
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
                {cargando ? '⏳' : '⬇️ Descargar'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
