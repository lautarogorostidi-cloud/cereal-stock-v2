'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetchAll'
import { elegirCampaniaActual } from '@/lib/campania'


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
  campo: string
  aplicador: string
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
  const [aplicadorSel, setAplicadorSel] = useState('')
  const [campoSel, setCampoSel] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargarCampanas() {
      const { data } = await supabase.from('campanas').select('id, nombre').eq('activo', true).order('nombre', { ascending: false })
      setCampanas(data ?? [])
      if (data && data.length > 0) setCampanaSeleccionada(elegirCampaniaActual(data.map((c: any) => c.nombre)))
    }
    cargarCampanas()
  }, [])

  useEffect(() => {
    if (!campanaSeleccionada) return
    cargar()
  }, [campanaSeleccionada])

  async function cargar() {
    setLoading(true)

    const { data, error } = await fetchAllRows(() => supabase
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
          proveedor,
          costo_servicio_usd_ha,
          sa_ciclos!inner(
            campanas!inner(nombre),
            lotes!inner(nombre, establecimiento),
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
      .order('id'))

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
        const campo = String(ciclo?.lotes?.establecimiento ?? '').trim() || 'Sin campo'
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
          campo,
          aplicador: String(apl?.proveedor ?? '').trim() || 'Sin aplicador',
          cultivo,
          total_litros_kg: dosis * superficie,
          costo_insumos_usd: costoInsumos,
          costo_servicio_usd: costoServicio,
          costo_total_usd: costoInsumos + costoServicio,
        }
      })
      .filter((ap: Aplicacion) => ap.campana === campanaSeleccionada)
      .sort((a: Aplicacion, b: Aplicacion) => a.fecha.localeCompare(b.fecha) || Number(a.aplicacion_id) - Number(b.aplicacion_id))

    setAplicaciones(transformados)
    setLoading(false)
  }

  const campos = Array.from(new Set(aplicaciones.map(a => a.campo))).sort((a, b) => a.localeCompare(b))
  const aplicadores = Array.from(new Set(aplicaciones.map(a => a.aplicador))).sort((a, b) => a.localeCompare(b))

  const filtradas = aplicaciones.filter(ap => {
    if (aplicadorSel && ap.aplicador !== aplicadorSel) return false
    if (campoSel && ap.campo !== campoSel) return false
    if (desde && ap.fecha < desde) return false
    if (hasta && ap.fecha > hasta) return false
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      ap.producto.toLowerCase().includes(q) ||
      ap.lote.toLowerCase().includes(q) ||
      ap.cultivo.toLowerCase().includes(q) ||
      ap.tipo.toLowerCase().includes(q)
    )
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || Number(a.aplicacion_id) - Number(b.aplicacion_id))

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

  // KPIs de superficie, fechas y aplicador: una fila por aplicación (no por producto)
  const aplicacionesUnicas = new Map<number, { fecha: string; ha: number; aplicador: string; lote: string }>()
  filtradas.forEach(a => {
    if (!aplicacionesUnicas.has(a.aplicacion_id)) {
      aplicacionesUnicas.set(a.aplicacion_id, { fecha: a.fecha, ha: a.superficie_ha, aplicador: a.aplicador, lote: a.lote })
    }
  })
  const listaUnicas = Array.from(aplicacionesUnicas.values())
  const hectareasAplicadas = listaUnicas.reduce((acc, a) => acc + a.ha, 0)
  const lotesDistintos = new Set(listaUnicas.map(a => a.lote)).size
  const fechasOrdenadas = listaUnicas.map(a => a.fecha).filter(Boolean).sort()
  const fechaPrimera = fechasOrdenadas[0] ?? ''
  const fechaUltima = fechasOrdenadas[fechasOrdenadas.length - 1] ?? ''
  const aplicadoresFiltrados = Array.from(new Set(listaUnicas.map(a => a.aplicador)))

  // Resumen por aplicador
  const resumenAplicador = listaUnicas.reduce((acc: Record<string, { aplicaciones: number; hectareas: number; lotes: Set<string>; primera: string; ultima: string }>, a) => {
    if (!acc[a.aplicador]) acc[a.aplicador] = { aplicaciones: 0, hectareas: 0, lotes: new Set(), primera: a.fecha, ultima: a.fecha }
    const r = acc[a.aplicador]
    r.aplicaciones += 1
    r.hectareas += a.ha
    r.lotes.add(a.lote)
    if (a.fecha && (!r.primera || a.fecha < r.primera)) r.primera = a.fecha
    if (a.fecha && a.fecha > r.ultima) r.ultima = a.fecha
    return acc
  }, {})

  // Resumen por lote: cada aplicación cuenta una sola vez (no una por producto)
  const resumenLote = (() => {
    const m = new Map<string, { campo: string; lote: string; cultivo: string; aplicaciones: Set<number>; ha: number; insumos: number; servicio: number; productos: Set<string>; ultima: string }>()
    const hectareasVistas = new Set<number>()
    filtradas.forEach(a => {
      const k = `${a.campo}|${a.lote}|${a.cultivo}`
      let r = m.get(k)
      if (!r) { r = { campo: a.campo, lote: a.lote, cultivo: a.cultivo, aplicaciones: new Set(), ha: 0, insumos: 0, servicio: 0, productos: new Set(), ultima: '' }; m.set(k, r) }
      if (!hectareasVistas.has(a.aplicacion_id)) { hectareasVistas.add(a.aplicacion_id); r.ha += a.superficie_ha }
      r.aplicaciones.add(a.aplicacion_id)
      r.insumos += a.costo_insumos_usd
      r.servicio += a.costo_servicio_usd
      r.productos.add(a.producto)
      if (a.fecha && a.fecha > r.ultima) r.ultima = a.fecha
    })
    return Array.from(m.values()).sort((x, y) => x.ultima.localeCompare(y.ultima) || x.campo.localeCompare(y.campo) || x.lote.localeCompare(y.lote, 'es', { numeric: true }))
  })()
  const totalesLote = resumenLote.reduce((t, r) => ({ aplicaciones: t.aplicaciones + r.aplicaciones.size, ha: t.ha + r.ha, insumos: t.insumos + r.insumos, servicio: t.servicio + r.servicio }), { aplicaciones: 0, ha: 0, insumos: 0, servicio: 0 })

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

      {/* KPIs: hectáreas, rango de fechas y aplicador */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Hectáreas aplicadas</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(hectareasAplicadas)} <span className="text-sm font-medium text-campo-400">ha</span></div>
          <div className="text-xs text-campo-400 mt-0.5">{lotesDistintos} {lotesDistintos === 1 ? 'lote' : 'lotes'} · suma de todas las pasadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Rango de fechas</div>
          <div className="text-2xl font-bold text-campo-900">
            {fechaPrimera ? (fechaPrimera === fechaUltima ? fmtFecha(fechaPrimera) : `${fmtFecha(fechaPrimera)} – ${fmtFecha(fechaUltima)}`) : '—'}
          </div>
          <div className="text-xs text-campo-400 mt-0.5">primera y última aplicación</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Aplicador</div>
          <div className="text-2xl font-bold text-campo-900 truncate">
            {aplicadoresFiltrados.length === 0 ? '—' : aplicadoresFiltrados.length === 1 ? aplicadoresFiltrados[0] : `${aplicadoresFiltrados.length} aplicadores`}
          </div>
          <div className="text-xs text-campo-400 mt-0.5 truncate">
            {aplicadoresFiltrados.length > 1 ? aplicadoresFiltrados.join(', ') : 'filtrá por aplicador abajo'}
          </div>
        </div>
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
        <select value={campanaSeleccionada} onChange={e => { setCampanaSeleccionada(e.target.value); setCampoSel(''); setAplicadorSel('') }}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          {campanas.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
        </select>
        <select value={campoSel} onChange={e => setCampoSel(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">Todos los campos</option>
          {campos.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={aplicadorSel} onChange={e => setAplicadorSel(e.target.value)}
          className="rounded-lg border border-campo-200 px-3 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">Todos los aplicadores</option>
          {aplicadores.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-campo-500">
          Desde
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="rounded-lg border border-campo-200 px-2 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-campo-500">
          Hasta
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="rounded-lg border border-campo-200 px-2 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </label>
        <div className="flex-1">
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, lote, cultivo, tipo..."
            className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>

      {/* Resumen por aplicador */}
      {Object.keys(resumenAplicador).length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Resumen por aplicador — {campanaSeleccionada}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Aplicador</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Aplicaciones</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Lotes</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Hectáreas</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Desde</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Hasta</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resumenAplicador)
                  .sort((a, b) => b[1].hectareas - a[1].hectareas)
                  .map(([nombre, r]) => (
                    <tr key={nombre} className="border-b border-campo-50 hover:bg-campo-50/50">
                      <td className="px-5 py-2 font-medium text-campo-900">{nombre}</td>
                      <td className="px-5 py-2 text-right text-campo-700">{r.aplicaciones}</td>
                      <td className="px-5 py-2 text-right text-campo-700">{r.lotes.size}</td>
                      <td className="px-5 py-2 text-right text-campo-700">{fmt(r.hectareas)} <span className="text-xs text-campo-400">ha</span></td>
                      <td className="px-5 py-2 text-right text-campo-700">{fmtFecha(r.primera)}</td>
                      <td className="px-5 py-2 text-right text-campo-700">{fmtFecha(r.ultima)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resumen por lote */}
      {resumenLote.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b border-campo-100 bg-campo-50">
            <h2 className="font-semibold text-campo-700 text-sm">Resumen por lote — {campanaSeleccionada}{campoSel ? ` · ${campoSel}` : ''}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Campo</th>
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Lote</th>
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Cultivo</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Aplicaciones</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Ha aplicadas</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Productos</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo insumos</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo servicio</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo total</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Última</th>
                </tr>
              </thead>
              <tbody>
                {resumenLote.map(r => (
                  <tr key={`${r.campo}|${r.lote}|${r.cultivo}`} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-5 py-2 text-campo-600">{r.campo}</td>
                    <td className="px-5 py-2 font-medium text-campo-900">{r.lote}</td>
                    <td className="px-5 py-2 text-campo-600">{r.cultivo}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{r.aplicaciones.size}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmt(r.ha)} <span className="text-xs text-campo-400">ha</span></td>
                    <td className="px-5 py-2 text-right text-campo-700">{r.productos.size}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmtUsd(r.insumos)}</td>
                    <td className="px-5 py-2 text-right text-campo-700">{fmtUsd(r.servicio)}</td>
                    <td className="px-5 py-2 text-right font-medium text-campo-900">{fmtUsd(r.insumos + r.servicio)}</td>
                    <td className="px-5 py-2 text-right text-campo-600">{fmtFecha(r.ultima)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-campo-50 font-semibold">
                  <td className="px-5 py-2 text-campo-900" colSpan={3}>Total ({resumenLote.length} {resumenLote.length === 1 ? 'lote' : 'lotes'})</td>
                  <td className="px-5 py-2 text-right text-campo-900">{totalesLote.aplicaciones}</td>
                  <td className="px-5 py-2 text-right text-campo-900">{fmt(totalesLote.ha)} <span className="text-xs text-campo-400">ha</span></td>
                  <td className="px-5 py-2"></td>
                  <td className="px-5 py-2 text-right text-campo-900">{fmtUsd(totalesLote.insumos)}</td>
                  <td className="px-5 py-2 text-right text-campo-900">{fmtUsd(totalesLote.servicio)}</td>
                  <td className="px-5 py-2 text-right text-campo-900">{fmtUsd(totalesLote.insumos + totalesLote.servicio)}</td>
                  <td className="px-5 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Aplicador</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Sup. (ha)</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Dosis/ha</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Total</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo insumos</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo servicio</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={12} className="px-5 py-10 text-center text-campo-400">Cargando...</td></tr>}
              {!loading && filtradas.length === 0 && <tr><td colSpan={12} className="px-5 py-10 text-center text-campo-400">No hay aplicaciones registradas para {campanaSeleccionada}</td></tr>}
              {!loading && filtradas.map((a, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 text-campo-600">{fmtFecha(a.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{a.producto}</td>
                  <td className="px-4 py-3 text-campo-600 text-xs">{TIPO_LABELS[a.tipo] ?? a.tipo}</td>
                  <td className="px-4 py-3 text-campo-600">{a.lote}</td>
                  <td className="px-4 py-3 text-campo-600">{a.cultivo}</td>
                  <td className="px-4 py-3 text-campo-600">{a.aplicador}</td>
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
