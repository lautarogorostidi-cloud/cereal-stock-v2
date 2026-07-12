'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Aplicacion = {
  aplicacion_id: number
  producto: string
  dosis_ha: number
  costo_unitario: number | null
  unidad: string | null
  tipo: string
  fecha: string
  superficie_ha: number
  campana: string
  lote: string
  cultivo: string
  total_litros_kg: number
  costo_insumos_usd: number
  costo_servicio_usd: number
  costo_total_usd: number
}

type Campana = { id: number; nombre: string }

const TIPO_LABELS: Record<string, string> = {
  barbecho: 'Barbecho',
  pre_siembra: 'Pre-siembra',
  pre_emergente: 'Pre-Emergente',
  post_emergente_temprano: 'Post-Emergente Temprano',
  post_emergente: 'Post-Emergente',
  rescate: 'Rescate',
  desecacion: 'Desecación',
  insecticida: 'Insecticida',
  fungicida: 'Fungicida',
}

export default function AplicacionesAgroquimicosPage() {
  const supabase = createClient()
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [campanaSeleccionada, setCampanaSeleccionada] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarCampanas() {
      const { data } = await supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre', { ascending: false })
      setCampanas(data ?? [])
      if (data && data.length > 0) setCampanaSeleccionada(data[0].nombre)
    }
    cargarCampanas()
  }, [])

  useEffect(() => {
    if (!campanaSeleccionada) return
    cargar()
  }, [campanaSeleccionada])

  async function cargar() {
    setLoading(true)

    const { data, error } = await supabase
      .from('sa_aplicacion_productos')
      .select(`
        aplicacion_id,
        producto,
        dosis_ha,
        costo_unitario,
        unidad,
        sa_aplicaciones!inner(
          tipo,
          fecha,
          superficie_ha,
          costo_servicio_usd_ha,
          sa_ciclos!inner(
            campanas!inner(nombre),
            lotes!inner(nombre),
            cultivos!inner(nombre)
          )
        )
      `)
      // Sin order()/limit() explícitos, Supabase corta en 1000 filas por
      // defecto y lo hace en silencio (sin error). sa_aplicacion_productos
      // ya superó esa marca, así que algunas aplicaciones (ej. Preside en
      // el lote 15T) quedaban afuera sin ningún aviso. Ordenamos y subimos
      // el límite bien por encima del volumen actual para traer todo.
      .order('aplicacion_id', { ascending: false })
      .limit(10000)

    if (error) {
      console.error('Error cargando aplicaciones:', error)
      setLoading(false)
      return
    }

    // Calcular costo servicio por aplicación (repartido entre productos de la misma aplicación)
    // Primero contamos cuántos productos tiene cada aplicación
    const prodPorAplicacion: Record<number, number> = {}
    ;(data ?? []).forEach((ap: any) => {
      prodPorAplicacion[ap.aplicacion_id] = (prodPorAplicacion[ap.aplicacion_id] ?? 0) + 1
    })

    const transformados: Aplicacion[] = (data ?? [])
      .map((ap: any) => {
        const apl = ap.sa_aplicaciones
        const ciclo = apl?.sa_ciclos
        const campana = ciclo?.campanas?.nombre ?? ''
        const lote = ciclo?.lotes?.nombre ?? ''
        const cultivo = ciclo?.cultivos?.nombre ?? ''
        const superficie = Number(apl?.superficie_ha ?? 0)
        const dosis = Number(ap.dosis_ha ?? 0)
        const costo = Number(ap.costo_unitario ?? 0)
        const costoServicioTotal = Number(apl?.costo_servicio_usd_ha ?? 0) * superficie
        const nProd = prodPorAplicacion[ap.aplicacion_id] ?? 1
        const costoInsumos = costo * dosis * superficie
        // Distribuir el costo de servicio proporcionalmente entre los productos
        const costoServicio = costoServicioTotal / nProd

        return {
          aplicacion_id: ap.aplicacion_id,
          producto: ap.producto,
          dosis_ha: dosis,
          costo_unitario: ap.costo_unitario,
          unidad: ap.unidad,
          tipo: apl?.tipo ?? '',
          fecha: apl?.fecha ?? '',
          superficie_ha: superficie,
          campana,
          lote,
          cultivo,
          total_litros_kg: dosis * superficie,
          costo_insumos_usd: costoInsumos,
          costo_servicio_usd: costoServicio,
          costo_total_usd: costoInsumos + costoServicio,
        }
      })
      .filter((ap: Aplicacion) => ap.campana === campanaSeleccionada)
      .sort((a: Aplicacion, b: Aplicacion) => b.fecha.localeCompare(a.fecha))

    setAplicaciones(transformados)
    setLoading(false)
  }

  const filtradas = aplicaciones.filter(ap => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      ap.producto.toLowerCase().includes(q) ||
      ap.lote.toLowerCase().includes(q) ||
      ap.cultivo.toLowerCase().includes(q) ||
      ap.tipo.toLowerCase().includes(q)
    )
  })

  // KPIs
  const cantidadAplicaciones = new Set(filtradas.map(a => a.aplicacion_id)).size
  const productosUnicos = new Set(filtradas.map(a => a.producto)).size
  const totalInsumos = filtradas.reduce((acc, a) => acc + a.costo_insumos_usd, 0)
  // Servicio: sumar una vez por aplicación (no por producto)
  const aplIds = new Set<number>()
  const totalServicio = filtradas.reduce((acc, a) => {
    if (aplIds.has(a.aplicacion_id)) return acc
    aplIds.add(a.aplicacion_id)
    return acc + a.costo_servicio_usd * (new Set(filtradas.filter(f => f.aplicacion_id === a.aplicacion_id)).size || 1)
  }, 0)
  const totalGeneral = totalInsumos + totalServicio

  // Resumen por producto
  const resumenProducto = filtradas.reduce((acc: Record<string, { total: number; insumos: number; servicio: number; hectareas: number; unidad: string }>, a) => {
    if (!acc[a.producto]) acc[a.producto] = { total: 0, insumos: 0, servicio: 0, hectareas: 0, unidad: a.unidad ?? 'L' }
    acc[a.producto].total += a.total_litros_kg
    acc[a.producto].insumos += a.costo_insumos_usd
    acc[a.producto].servicio += a.costo_servicio_usd
    acc[a.producto].hectareas += a.superficie_ha
    return acc
  }, {})

  const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const fmtUsd = (n: number) => n > 0 ? `USD ${Math.round(n).toLocaleString('es-AR')}` : '—'
  const fmtFecha = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Aplicaciones en Campo</h1>
        <p className="text-campo-500 text-sm mt-0.5">Agroquímicos aplicados desde Seguimiento Agronómico</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Q Aplicaciones</div>
          <div className="text-2xl font-bold text-campo-900">{cantidadAplicaciones}</div>
          <div className="text-xs text-campo-400 mt-0.5">en {campanaSeleccionada}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Productos distintos</div>
          <div className="text-2xl font-bold text-campo-900">{productosUnicos}</div>
          <div className="text-xs text-campo-400 mt-0.5">productos usados</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo insumos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalInsumos)}</div>
          <div className="text-xs text-campo-400 mt-0.5">estimado campaña</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo servicio</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalServicio)}</div>
          <div className="text-xs text-campo-400 mt-0.5">pulverización</div>
        </div>
        <div className="card p-5 border-emerald-200 bg-emerald-50/50">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo total</div>
          <div className="text-2xl font-bold text-emerald-700">{fmtUsd(totalGeneral)}</div>
          <div className="text-xs text-campo-400 mt-0.5">insumos + servicio</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={campanaSeleccionada} onChange={e => setCampanaSeleccionada(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <div className="flex-1">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, lote, cultivo, tipo..."
            className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>

      {/* Resumen por producto */}
      {Object.keys(resumenProducto).length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Resumen por producto — {campanaSeleccionada}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100">
                <th className="text-left px-5 py-2 font-semibold text-campo-700">Producto</th>
                <th className="text-right px-5 py-2 font-semibold text-campo-700">Hectáreas</th>
                <th className="text-right px-5 py-2 font-semibold text-campo-700">Total aplicado</th>
                <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo insumos</th>
                <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo servicio</th>
                <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resumenProducto)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([prod, data]) => (
                  <tr key={prod} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-5 py-2 font-medium text-campo-900">{prod}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmt(data.hectareas)} <span className="text-xs text-campo-400">ha</span></td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmt(data.total)} <span className="text-xs text-campo-400">{data.unidad}</span></td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmtUsd(data.insumos)}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmtUsd(data.servicio)}</td>
                    <td className="px-5 py-2 text-right font-medium text-campo-900">{fmtUsd(data.insumos + data.servicio)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabla detalle */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
          <h2 className="font-semibold text-campo-700 text-sm">Detalle de aplicaciones</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Producto</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Sup. (ha)</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Dosis/ha</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo insumos</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo servicio</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && filtradas.length === 0 && <tr><td colSpan={11} className="px-5 py-10 text-center text-campo-400">No hay aplicaciones registradas para {campanaSeleccionada}</td></tr>}
              {!loading && filtradas.map((a, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{fmtFecha(a.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{a.producto}</td>
                  <td className="px-4 py-3 text-campo-600 text-xs">{TIPO_LABELS[a.tipo] ?? a.tipo}</td>
                  <td className="px-4 py-3 text-campo-600">{a.lote}</td>
                  <td className="px-4 py-3 text-campo-600">{a.cultivo}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{fmt(a.superficie_ha)}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{fmt(a.dosis_ha)} <span className="text-xs text-campo-400">{a.unidad ?? 'L'}</span></td>
                  <td className="px-4 py-3 text-right text-campo-700">{fmt(a.total_litros_kg)} <span className="text-xs text-campo-400">{a.unidad ?? 'L'}</span></td>
                  <td className="px-4 py-3 text-right text-campo-700">{fmtUsd(a.costo_insumos_usd)}</td>
                  <td className="px-4 py-3 text-right text-campo-700">{fmtUsd(a.costo_servicio_usd)}</td>
                  <td className="px-4 py-3 text-right font-medium text-campo-900">{fmtUsd(a.costo_total_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
