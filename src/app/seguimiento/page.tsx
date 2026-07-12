'use client'

import { Fragment, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Resumen = {
  ciclo_id: number
  campana: string
  lote: string
  campo: string
  hectareas: number
  cultivo: string
  actividad: string | null
  sup_sembrada: number
  sup_cosechada: number | null
  fecha_siembra: string | null
  fecha_cosecha: string | null
  rinde_kg_ha: number | null
  rinde_kg_total: number | null
  costo_semillas_usd: number
  costo_insumos_usd: number
  costo_fertilizantes_usd: number
  costo_servicios_usd: number
  costo_fijos_usd: number
}

type Acondicionamiento = { ciclo_id: number; fecha: string | null; superficie_ha: number | null; costo_usd_ha: number | null }

type Siembra = {
  ciclo_id: number
  fecha: string | null
  costo_semilla_total: number | null
  costo_servicio_total: number | null
  hibrido_1: string | null
  sup_hibrido_1: number | null
  cu_hibrido_1: number | null
  hibrido_2: string | null
  sup_hibrido_2: number | null
  cu_hibrido_2: number | null
  hibrido_3: string | null
  sup_hibrido_3: number | null
  cu_hibrido_3: number | null
  densidad: number | null
  unidad_densidad: string | null
  fertilizante_1: string | null
  fertilizante_1_kg_ha: number | null
  fertilizante_1_costo_kg: number | null
  fertilizante_2: string | null
  fertilizante_2_kg_ha: number | null
  fertilizante_2_costo_kg: number | null
}

type Aplicacion = { id: number; ciclo_id: number; fecha: string | null; tipo: string; superficie_ha: number | null; costo_servicio_usd_ha: number | null }
type AplicacionProducto = { aplicacion_id: number; producto: string | null; unidad: string | null; dosis_ha: number | null; costo_unitario: number | null }
type Fertilizacion = { ciclo_id: number; fecha: string | null; tipo_fertilizante: string | null; cantidad_ha: number | null; superficie_ha: number | null; costo_usd_ha: number | null; costo_servicio_usd_ha: number | null }
type Cosecha = { ciclo_id: number; fecha: string | null; superficie_ha: number | null; costo_cosecha_usd_ha: number | null }
type Resiembra = { ciclo_id: number; fecha: string | null; superficie_ha: number | null }
type CostoFijoDirecto = { ciclo_id: number; tipo: string | null; costo_total_usd: number | null }
type CostoFijoDistribuido = { ciclo_id: number; tipo: string | null; costo_ciclo: number | null }

type DetalleItem = {
  ciclo_id: number
  lote: string
  campo: string
  cultivo: string
  valor: number
  ultimaFecha: string | null
}

type ProductoDetalle = { producto: string; cantidad: number; unidad: string; costo: number }

const ORDEN_INSUMOS = ['Semillas', 'Fertilizante', 'Fitosanitario']

const ORDEN_SERVICIOS = ['Acondicionado', 'Siembra', 'Pulverización', 'Fertilización', 'Cosecha']

const ORDEN_HECTAREAS = ['Acondicionado', 'Siembra', 'Pulverización', 'Fertilización', 'Cosecha', 'Resiembra']

function fechaCorta(f: string | null) {
  if (!f) return '—'
  try { return new Date(f).toLocaleDateString('es-AR') } catch { return f }
}

function normalizarUnidad(u?: string | null): string {
  if (!u) return ''
  const t = u.trim().toLowerCase()
  if (t === 'l' || t === 'litros' || t === 'litro') return 'L'
  if (t === 'kg' || t === 'kilos' || t === 'kilo' || t === 'kg_ha') return 'kg'
  if (t === 'pl_ha') return 'semillas'
  return u.trim()
}

export default function SeguimientoDashboard() {
  const supabase = createClient()
  const [ciclos, setCiclos] = useState<Resumen[]>([])
  const [campanas, setCampanas] = useState<string[]>([])
  const [campanaActual, setCampanaActual] = useState('')
  const [acondicionamientos, setAcondicionamientos] = useState<Acondicionamiento[]>([])
  const [siembras, setSiembras] = useState<Siembra[]>([])
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [aplProductos, setAplProductos] = useState<AplicacionProducto[]>([])
  const [fertilizaciones, setFertilizaciones] = useState<Fertilizacion[]>([])
  const [cosechas, setCosechas] = useState<Cosecha[]>([])
  const [resiembras, setResiembras] = useState<Resiembra[]>([])
  const [costosFijosDirectos, setCostosFijosDirectos] = useState<CostoFijoDirecto[]>([])
  const [distribucionCostosFijos, setDistribucionCostosFijos] = useState<CostoFijoDistribuido[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccion, setSeleccion] = useState<{ tabla: 'hectareas' | 'insumos' | 'servicios' | 'fijos'; categoria: string } | null>(null)
  const [cultivoFiltro, setCultivoFiltro] = useState('Todos')
  const [campoFiltro, setCampoFiltro] = useState('Todos')
  const [actividadFiltro, setActividadFiltro] = useState('Todos')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [
        { data: cs }, { data: caps },
        { data: acon }, { data: siem }, { data: apls }, { data: aplProds },
        { data: fert }, { data: cos }, { data: resi },
        { data: cfDirectos }, { data: cfDistribuidos },
      ] = await Promise.all([
        supabase.from('vw_sa_resumen_ciclo').select('*'),
        supabase.from('campanas').select('nombre').order('nombre', { ascending: false }),
        supabase.from('sa_acondicionamiento').select('ciclo_id, fecha, superficie_ha, costo_usd_ha').limit(10000),
        supabase.from('sa_siembras').select('ciclo_id, fecha, costo_semilla_total, costo_servicio_total, hibrido_1, sup_hibrido_1, cu_hibrido_1, hibrido_2, sup_hibrido_2, cu_hibrido_2, hibrido_3, sup_hibrido_3, cu_hibrido_3, densidad, unidad_densidad, fertilizante_1, fertilizante_1_kg_ha, fertilizante_1_costo_kg, fertilizante_2, fertilizante_2_kg_ha, fertilizante_2_costo_kg').limit(10000),
        supabase.from('sa_aplicaciones').select('id, ciclo_id, fecha, tipo, superficie_ha, costo_servicio_usd_ha').limit(10000),
        supabase.from('sa_aplicacion_productos').select('aplicacion_id, producto, unidad, dosis_ha, costo_unitario').limit(10000),
        supabase.from('sa_fertilizaciones').select('ciclo_id, fecha, tipo_fertilizante, cantidad_ha, superficie_ha, costo_usd_ha, costo_servicio_usd_ha').limit(10000),
        supabase.from('sa_cosechas').select('ciclo_id, fecha, superficie_ha, costo_cosecha_usd_ha').limit(10000),
        supabase.from('sa_resiembras').select('ciclo_id, fecha, superficie_ha').limit(10000),
        supabase.from('sa_costos_fijos').select('ciclo_id, tipo, costo_total_usd').limit(10000),
        supabase.from('vw_distribucion_costos_fijos').select('ciclo_id, tipo, costo_ciclo').limit(10000),
      ])
      const nombres = (caps ?? []).map((c: any) => c.nombre)
      setCiclos(cs ?? [])
      setCampanas(nombres)
      setCampanaActual(nombres[0] ?? '')
      setAcondicionamientos(acon ?? [])
      setSiembras(siem ?? [])
      setAplicaciones(apls ?? [])
      setAplProductos(aplProds ?? [])
      setFertilizaciones(fert ?? [])
      setCosechas(cos ?? [])
      setResiembras(resi ?? [])
      setCostosFijosDirectos(cfDirectos ?? [])
      setDistribucionCostosFijos(cfDistribuidos ?? [])
      setLoading(false)
    }
    cargar()
  }, [])

  const fmt = (n: number | null | undefined) =>
    Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const fmtUsd = (n: number) =>
    `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
  const fmtCantidad = (n: number, unidad: string) =>
    `${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${unidad ? ' ' + unidad : ''}`

  const ciclosDeCampana = ciclos.filter(r => r.campana === campanaActual)
  const cultivosDisponibles = Array.from(new Set(ciclosDeCampana.map(r => r.cultivo))).sort()
  const camposDisponibles = Array.from(new Set(ciclosDeCampana.map(r => r.campo))).sort()
  const actividadesDisponibles = Array.from(new Set(ciclosDeCampana.map(r => r.actividad).filter((a): a is string => !!a))).sort()

  const ciclosCampana = ciclosDeCampana.filter(r =>
    (cultivoFiltro === 'Todos' || r.cultivo === cultivoFiltro) &&
    (campoFiltro === 'Todos' || r.campo === campoFiltro) &&
    (actividadFiltro === 'Todos' || r.actividad === actividadFiltro)
  )
  const cicloIds = new Set(ciclosCampana.map(r => r.ciclo_id))
  const cicloInfo: Record<number, { lote: string; campo: string; cultivo: string }> = {}
  ciclosCampana.forEach(r => { cicloInfo[r.ciclo_id] = { lote: r.lote, campo: r.campo, cultivo: r.cultivo } })

  function agruparPorCiclo(items: { ciclo_id: number; valor: number; fecha?: string | null }[]): DetalleItem[] {
    const acc: Record<number, DetalleItem> = {}
    items.forEach(it => {
      const info = cicloInfo[it.ciclo_id]
      if (!info) return
      if (!acc[it.ciclo_id]) {
        acc[it.ciclo_id] = { ciclo_id: it.ciclo_id, lote: info.lote, campo: info.campo, cultivo: info.cultivo, valor: 0, ultimaFecha: null }
      }
      acc[it.ciclo_id].valor += it.valor
      if (it.fecha && (!acc[it.ciclo_id].ultimaFecha || it.fecha > (acc[it.ciclo_id].ultimaFecha as string))) {
        acc[it.ciclo_id].ultimaFecha = it.fecha
      }
    })
    return Object.values(acc).sort((a, b) => b.valor - a.valor)
  }

  const totalHaSembrada = ciclosCampana.reduce((acc, r) => acc + Number(r.sup_sembrada ?? r.hectareas ?? 0), 0)
  const totalHaCosechada = ciclosCampana.reduce((acc, r) => acc + Number(r.sup_cosechada ?? 0), 0)
  const totalKg = ciclosCampana.reduce((acc, r) => acc + Number(r.rinde_kg_total ?? 0), 0)
  const costoTotal = ciclosCampana.reduce((acc, r) =>
    acc + Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
    Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) +
    Number(r.costo_fijos_usd ?? 0), 0)

  // ── Hectáreas trabajadas: suma de toda la actividad de la campaña ──
  const haAcondicionadas = acondicionamientos.filter(a => cicloIds.has(a.ciclo_id)).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)
  const haPulverizadas = aplicaciones.filter(a => cicloIds.has(a.ciclo_id)).reduce((acc, a) => acc + Number(a.superficie_ha ?? 0), 0)
  const haFertilizadas = fertilizaciones.filter(f => cicloIds.has(f.ciclo_id)).reduce((acc, f) => acc + Number(f.superficie_ha ?? 0), 0)
  const haResembradas = resiembras.filter(r => cicloIds.has(r.ciclo_id)).reduce((acc, r) => acc + Number(r.superficie_ha ?? 0), 0)
  const haTrabajadas = haAcondicionadas + totalHaSembrada + haPulverizadas + haFertilizadas + totalHaCosechada + haResembradas

  const haTrabajadasDesglose: Record<string, number> = {
    Acondicionado: haAcondicionadas,
    Siembra: totalHaSembrada,
    Pulverización: haPulverizadas,
    Fertilización: haFertilizadas,
    Cosecha: totalHaCosechada,
    Resiembra: haResembradas,
  }

  const detalleHectareas: Record<string, DetalleItem[]> = {
    Acondicionado: agruparPorCiclo(acondicionamientos.filter(a => cicloIds.has(a.ciclo_id)).map(a => ({ ciclo_id: a.ciclo_id, valor: Number(a.superficie_ha ?? 0), fecha: a.fecha }))),
    Siembra: agruparPorCiclo(ciclosCampana.map(r => ({ ciclo_id: r.ciclo_id, valor: Number(r.sup_sembrada ?? r.hectareas ?? 0), fecha: r.fecha_siembra }))),
    Pulverización: agruparPorCiclo(aplicaciones.filter(a => cicloIds.has(a.ciclo_id)).map(a => ({ ciclo_id: a.ciclo_id, valor: Number(a.superficie_ha ?? 0), fecha: a.fecha }))),
    Fertilización: agruparPorCiclo(fertilizaciones.filter(f => cicloIds.has(f.ciclo_id)).map(f => ({ ciclo_id: f.ciclo_id, valor: Number(f.superficie_ha ?? 0), fecha: f.fecha }))),
    Cosecha: agruparPorCiclo(ciclosCampana.filter(r => r.sup_cosechada).map(r => ({ ciclo_id: r.ciclo_id, valor: Number(r.sup_cosechada ?? 0), fecha: r.fecha_cosecha }))),
    Resiembra: agruparPorCiclo(resiembras.filter(r => cicloIds.has(r.ciclo_id)).map(r => ({ ciclo_id: r.ciclo_id, valor: Number(r.superficie_ha ?? 0), fecha: r.fecha }))),
  }

  // ── Costo de insumos ──
  const productosPorAplicacion: Record<number, AplicacionProducto[]> = {}
  aplProductos.forEach(p => {
    if (!productosPorAplicacion[p.aplicacion_id]) productosPorAplicacion[p.aplicacion_id] = []
    productosPorAplicacion[p.aplicacion_id].push(p)
  })
  // unidad de respaldo por producto, para filas viejas sin unidad cargada
  const unidadPorProducto: Record<string, string> = {}
  aplProductos.forEach(p => {
    const key = (p.producto ?? '').trim().toLowerCase()
    const u = normalizarUnidad(p.unidad)
    if (key && u && !unidadPorProducto[key]) unidadPorProducto[key] = u
  })

  const costoInsumos: Record<string, number> = {}
  const costoServicios: Record<string, number> = {}
  ORDEN_INSUMOS.forEach(k => { costoInsumos[k] = 0 })
  ORDEN_SERVICIOS.forEach(k => { costoServicios[k] = 0 })

  const rawFertilizanteInsumo: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawFitosanitario: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawSemillas: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawServicioSiembra: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawServicioAcondicionado: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawServicioPulverizacion: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawServicioFertilizacion: { ciclo_id: number; valor: number; fecha: string | null }[] = []
  const rawServicioCosecha: { ciclo_id: number; valor: number; fecha: string | null }[] = []

  const productosSemillas: Record<string, ProductoDetalle> = {}
  const productosFertilizante: Record<string, ProductoDetalle> = {}
  const productosFitosanitario: Record<string, ProductoDetalle> = {}

  function sumarProducto(mapa: Record<string, ProductoDetalle>, nombre: string | null | undefined, cantidad: number, unidad: string, costo: number) {
    if (!nombre || !nombre.trim()) return
    const key = nombre.trim().toLowerCase()
    if (!mapa[key]) mapa[key] = { producto: nombre.trim(), cantidad: 0, unidad, costo: 0 }
    mapa[key].cantidad += cantidad
    mapa[key].costo += costo
  }

  siembras.filter(s => cicloIds.has(s.ciclo_id)).forEach(s => {
    costoInsumos['Semillas'] += Number(s.costo_semilla_total ?? 0)
    rawSemillas.push({ ciclo_id: s.ciclo_id, valor: Number(s.costo_semilla_total ?? 0), fecha: s.fecha })

    const hibridos = [
      { nombre: s.hibrido_1, sup: s.sup_hibrido_1 },
      { nombre: s.hibrido_2, sup: s.sup_hibrido_2 },
      { nombre: s.hibrido_3, sup: s.sup_hibrido_3 },
    ].filter(h => h.nombre && Number(h.sup ?? 0) > 0)
    const totalSupHibridos = hibridos.reduce((acc, h) => acc + Number(h.sup ?? 0), 0)
    const costoSemillaTotal = Number(s.costo_semilla_total ?? 0)
    const unidadSemilla = normalizarUnidad(s.unidad_densidad)
    hibridos.forEach(h => {
      const cantidad = Number(s.densidad ?? 0) * Number(h.sup ?? 0)
      const costo = totalSupHibridos > 0 ? costoSemillaTotal * (Number(h.sup ?? 0) / totalSupHibridos) : 0
      sumarProducto(productosSemillas, h.nombre, cantidad, unidadSemilla, costo)
    })

    const supHib1 = Number(s.sup_hibrido_1 ?? 0)
    let fertSiembra = 0
    if (s.fertilizante_1_kg_ha && s.fertilizante_1_costo_kg) {
      const cant = Number(s.fertilizante_1_kg_ha) * supHib1
      const costo = cant * Number(s.fertilizante_1_costo_kg)
      fertSiembra += costo
      sumarProducto(productosFertilizante, s.fertilizante_1, cant, 'kg', costo)
    }
    if (s.fertilizante_2_kg_ha && s.fertilizante_2_costo_kg) {
      const cant = Number(s.fertilizante_2_kg_ha) * supHib1
      const costo = cant * Number(s.fertilizante_2_costo_kg)
      fertSiembra += costo
      sumarProducto(productosFertilizante, s.fertilizante_2, cant, 'kg', costo)
    }
    costoInsumos['Fertilizante'] += fertSiembra
    if (fertSiembra > 0) rawFertilizanteInsumo.push({ ciclo_id: s.ciclo_id, valor: fertSiembra, fecha: s.fecha })
    costoServicios['Siembra'] += Number(s.costo_servicio_total ?? 0)
    rawServicioSiembra.push({ ciclo_id: s.ciclo_id, valor: Number(s.costo_servicio_total ?? 0), fecha: s.fecha })
  })

  acondicionamientos.filter(a => cicloIds.has(a.ciclo_id)).forEach(a => {
    const costo = Number(a.superficie_ha ?? 0) * Number(a.costo_usd_ha ?? 0)
    costoServicios['Acondicionado'] += costo
    rawServicioAcondicionado.push({ ciclo_id: a.ciclo_id, valor: costo, fecha: a.fecha })
  })

  aplicaciones.filter(a => cicloIds.has(a.ciclo_id)).forEach(a => {
    const sup = Number(a.superficie_ha ?? 0)
    const costoServ = sup * Number(a.costo_servicio_usd_ha ?? 0)
    costoServicios['Pulverización'] += costoServ
    rawServicioPulverizacion.push({ ciclo_id: a.ciclo_id, valor: costoServ, fecha: a.fecha })
    const productos = productosPorAplicacion[a.id] ?? []
    let costoProductosAplicacion = 0
    productos.forEach(p => {
      const cantidad = Number(p.dosis_ha ?? 0) * sup
      const costo = cantidad * Number(p.costo_unitario ?? 0)
      costoProductosAplicacion += costo
      const key = (p.producto ?? '').trim().toLowerCase()
      const unidad = normalizarUnidad(p.unidad) || unidadPorProducto[key] || ''
      sumarProducto(productosFitosanitario, p.producto, cantidad, unidad, costo)
    })
    costoInsumos['Fitosanitario'] += costoProductosAplicacion
    rawFitosanitario.push({ ciclo_id: a.ciclo_id, valor: costoProductosAplicacion, fecha: a.fecha })
  })

  fertilizaciones.filter(f => cicloIds.has(f.ciclo_id)).forEach(f => {
    const sup = Number(f.superficie_ha ?? 0)
    const costoInsumo = Number(f.cantidad_ha ?? 0) * sup * Number(f.costo_usd_ha ?? 0)
    costoInsumos['Fertilizante'] += costoInsumo
    if (costoInsumo > 0) rawFertilizanteInsumo.push({ ciclo_id: f.ciclo_id, valor: costoInsumo, fecha: f.fecha })
    sumarProducto(productosFertilizante, f.tipo_fertilizante, Number(f.cantidad_ha ?? 0) * sup, 'kg', costoInsumo)
    const costoServ = sup * Number(f.costo_servicio_usd_ha ?? 0)
    costoServicios['Fertilización'] += costoServ
    rawServicioFertilizacion.push({ ciclo_id: f.ciclo_id, valor: costoServ, fecha: f.fecha })
  })

  cosechas.filter(c => cicloIds.has(c.ciclo_id)).forEach(c => {
    const costo = Number(c.superficie_ha ?? 0) * Number(c.costo_cosecha_usd_ha ?? 0)
    costoServicios['Cosecha'] += costo
    rawServicioCosecha.push({ ciclo_id: c.ciclo_id, valor: costo, fecha: c.fecha })
  })

  const totalInsumosDesglose = Object.values(costoInsumos).reduce((a, b) => a + b, 0)
  const totalServiciosDesglose = Object.values(costoServicios).reduce((a, b) => a + b, 0)

  const detalleInsumos: Record<string, DetalleItem[]> = {
    Semillas: agruparPorCiclo(rawSemillas),
    Fertilizante: agruparPorCiclo(rawFertilizanteInsumo),
    Fitosanitario: agruparPorCiclo(rawFitosanitario),
  }

  const productosInsumos: Record<string, ProductoDetalle[]> = {
    Semillas: Object.values(productosSemillas).sort((a, b) => b.costo - a.costo),
    Fertilizante: Object.values(productosFertilizante).sort((a, b) => b.costo - a.costo),
    Fitosanitario: Object.values(productosFitosanitario).sort((a, b) => b.costo - a.costo),
  }

  const detalleServicios: Record<string, DetalleItem[]> = {
    Acondicionado: agruparPorCiclo(rawServicioAcondicionado),
    Siembra: agruparPorCiclo(rawServicioSiembra),
    Pulverización: agruparPorCiclo(rawServicioPulverizacion),
    Fertilización: agruparPorCiclo(rawServicioFertilizacion),
    Cosecha: agruparPorCiclo(rawServicioCosecha),
  }

  // ── Costos fijos (seguro, asesoramiento, arrendamiento, etc.) ──
  const costoFijos: Record<string, number> = {}
  const rawCostoFijos: Record<string, { ciclo_id: number; valor: number; fecha: string | null }[]> = {}

  function sumarCostoFijo(tipo: string | null | undefined, ciclo_id: number, valor: number) {
    if (!tipo || !cicloIds.has(ciclo_id) || !valor) return
    const label = tipo.trim().charAt(0).toUpperCase() + tipo.trim().slice(1)
    costoFijos[label] = (costoFijos[label] ?? 0) + valor
    if (!rawCostoFijos[label]) rawCostoFijos[label] = []
    rawCostoFijos[label].push({ ciclo_id, valor, fecha: null })
  }

  costosFijosDirectos.forEach(c => sumarCostoFijo(c.tipo, c.ciclo_id, Number(c.costo_total_usd ?? 0)))
  distribucionCostosFijos.forEach(d => sumarCostoFijo(d.tipo, d.ciclo_id, Number(d.costo_ciclo ?? 0)))

  const totalCostoFijosDesglose = Object.values(costoFijos).reduce((a, b) => a + b, 0)
  const categoriasCostoFijos = Object.keys(costoFijos).sort((a, b) => costoFijos[b] - costoFijos[a])
  const detalleCostoFijos: Record<string, DetalleItem[]> = {}
  categoriasCostoFijos.forEach(k => { detalleCostoFijos[k] = agruparPorCiclo(rawCostoFijos[k] ?? []) })

  const porCultivo = ciclosCampana.reduce((acc: Record<string, any>, r) => {
    if (!acc[r.cultivo]) acc[r.cultivo] = { lotes: 0, haSembrada: 0, haCosechada: 0, kg: 0, costo: 0 }
    acc[r.cultivo].lotes++
    acc[r.cultivo].haSembrada += Number(r.sup_sembrada ?? r.hectareas ?? 0)
    acc[r.cultivo].haCosechada += Number(r.sup_cosechada ?? 0)
    acc[r.cultivo].kg += Number(r.rinde_kg_total ?? 0)
    acc[r.cultivo].costo += Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
      Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) + Number(r.costo_fijos_usd ?? 0)
    return acc
  }, {})

  function toggleSeleccion(tabla: 'hectareas' | 'insumos' | 'servicios' | 'fijos', categoria: string) {
    setSeleccion(prev => (prev && prev.tabla === tabla && prev.categoria === categoria) ? null : { tabla, categoria })
  }

  const detalleActual: DetalleItem[] = seleccion
    ? (seleccion.tabla === 'hectareas' ? detalleHectareas[seleccion.categoria]
      : seleccion.tabla === 'insumos' ? detalleInsumos[seleccion.categoria]
        : seleccion.tabla === 'fijos' ? detalleCostoFijos[seleccion.categoria]
          : detalleServicios[seleccion.categoria]) ?? []
    : []
  const cicloIdsSeleccion = new Set(detalleActual.map(d => d.ciclo_id))

  // Fila de categoría con detalle por lote (Hectáreas, Servicios y Costos Fijos)
  function filaCategoriaLote(
    tabla: 'hectareas' | 'servicios' | 'fijos',
    categoria: string,
    valor: number,
    total: number,
    detalle: DetalleItem[],
    formatoValor: (n: number) => string,
  ) {
    const activa = seleccion?.tabla === tabla && seleccion?.categoria === categoria
    return (
      <Fragment key={categoria}>
        <tr
          onClick={() => toggleSeleccion(tabla, categoria)}
          className={`border-b border-campo-50 cursor-pointer transition-colors ${activa ? 'bg-lime-50' : 'hover:bg-campo-50/50'}`}
        >
          <td className="px-5 py-2 text-campo-700">{categoria}</td>
          <td className="px-5 py-2 text-right font-medium text-campo-900">{formatoValor(valor)}</td>
          <td className="px-5 py-2 text-right text-campo-500">
            {total > 0 ? `${((valor / total) * 100).toFixed(0)}%` : '—'}
          </td>
        </tr>
        {activa && (
          <tr>
            <td colSpan={3} className="px-5 py-3 bg-lime-50/50">
              <div className="text-xs text-campo-500 mb-1.5">Detalle por lote (clic de nuevo para cerrar):</div>
              <div className="space-y-1">
                {detalle.length === 0 && <div className="text-xs text-campo-400">Sin registros</div>}
                {detalle.map(d => (
                  <div key={d.ciclo_id} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border border-campo-100">
                    <span className="font-medium text-campo-900">{d.lote} <span className="text-campo-400 font-normal">· {d.campo} · {d.cultivo}</span></span>
                    <span className="text-campo-600">{formatoValor(d.valor)} · últ. {fechaCorta(d.ultimaFecha)}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  // Fila de categoría de Insumos, con detalle por producto (nombre + cantidad + unidad)
  function filaCategoriaProducto(categoria: string, valor: number, total: number, productos: ProductoDetalle[]) {
    const activa = seleccion?.tabla === 'insumos' && seleccion?.categoria === categoria
    return (
      <Fragment key={categoria}>
        <tr
          onClick={() => toggleSeleccion('insumos', categoria)}
          className={`border-b border-campo-50 cursor-pointer transition-colors ${activa ? 'bg-lime-50' : 'hover:bg-campo-50/50'}`}
        >
          <td className="px-5 py-2 text-campo-700">{categoria}</td>
          <td className="px-5 py-2 text-right font-medium text-campo-900">{fmtUsd(valor)}</td>
          <td className="px-5 py-2 text-right text-campo-500">
            {total > 0 ? `${((valor / total) * 100).toFixed(0)}%` : '—'}
          </td>
        </tr>
        {activa && (
          <tr>
            <td colSpan={3} className="px-5 py-3 bg-lime-50/50">
              <div className="text-xs text-campo-500 mb-1.5">Detalle por producto (clic de nuevo para cerrar):</div>
              <div className="space-y-1">
                {productos.length === 0 && <div className="text-xs text-campo-400">Sin registros</div>}
                {productos.map(p => (
                  <div key={p.producto} className="flex items-center justify-between text-xs bg-white rounded px-3 py-1.5 border border-campo-100">
                    <span className="font-medium text-campo-900">{p.producto}</span>
                    <span className="text-campo-600">{fmtCantidad(p.cantidad, p.unidad)} · {fmtUsd(p.costo)}</span>
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  const hayFiltrosActivos = cultivoFiltro !== 'Todos' || campoFiltro !== 'Todos' || actividadFiltro !== 'Todos'
  const labelActividad = (a: string) => a === 'agricola' ? 'Agrícola' : a === 'ganadero' ? 'Ganadero' : a

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Seguimiento Agronómico</h1>
          <p className="text-campo-500 text-sm mt-0.5">
            Campaña: {campanaActual}
            {hayFiltrosActivos && (
              <>
                {' · '}
                {cultivoFiltro !== 'Todos' && <span>Cultivo: {cultivoFiltro} </span>}
                {campoFiltro !== 'Todos' && <span>Campo: {campoFiltro} </span>}
                {actividadFiltro !== 'Todos' && <span>Actividad: {labelActividad(actividadFiltro)} </span>}
                <button
                  onClick={() => { setCultivoFiltro('Todos'); setCampoFiltro('Todos'); setActividadFiltro('Todos') }}
                  className="text-lime-700 underline hover:text-lime-600"
                >
                  quitar filtros
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={campanaActual}
            onChange={e => {
              setCampanaActual(e.target.value)
              setCultivoFiltro('Todos'); setCampoFiltro('Todos'); setActividadFiltro('Todos')
            }}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            {campanas.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={cultivoFiltro}
            onChange={e => setCultivoFiltro(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="Todos">Todos los cultivos</option>
            {cultivosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={campoFiltro}
            onChange={e => setCampoFiltro(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="Todos">Todos los campos</option>
            {camposDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={actividadFiltro}
            onChange={e => setActividadFiltro(e.target.value)}
            className="rounded-lg border border-campo-200 px-3 py-1.5 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-lime-400"
          >
            <option value="Todos">Agrícola y ganadero</option>
            {actividadesDisponibles.map(a => <option key={a} value={a}>{labelActividad(a)}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Lotes</div>
          <div className="text-2xl font-bold text-campo-900">{ciclosCampana.length}</div>
          <div className="text-xs text-campo-400 mt-0.5">en campaña {campanaActual}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Superficie</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalHaSembrada)}</div>
          <div className="text-xs text-campo-400 mt-0.5">ha sembradas · {fmt(totalHaCosechada)} cosechadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Producción</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalKg / 1000)}</div>
          <div className="text-xs text-campo-400 mt-0.5">toneladas cosechadas</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Total</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(costoTotal)}</div>
          <div className="text-xs text-campo-400 mt-0.5">implantación + fijos</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Hectáreas Trabajadas</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(haTrabajadas)}</div>
          <div className="text-xs text-campo-400 mt-0.5">acondic. + siembra + pulv. + fert. + cosecha + resiembra</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Insumos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalInsumosDesglose)}</div>
          <div className="text-xs text-campo-400 mt-0.5">semillas + fertilizante + fitosanitarios</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Servicios</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalServiciosDesglose)}</div>
          <div className="text-xs text-campo-400 mt-0.5">acondic. + siembra + pulv. + fert. + cosecha</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costos Fijos</div>
          <div className="text-2xl font-bold text-campo-900">{fmtUsd(totalCostoFijosDesglose)}</div>
          <div className="text-xs text-campo-400 mt-0.5">arrendamiento + seguros + asesoramiento + otros</div>
        </div>
      </div>

      {/* Desglose de costos y hectáreas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Costo de Insumos por Categoría</h2>
            <p className="text-xs text-campo-400 mt-0.5">Clic en una fila para ver el detalle por producto</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Categoría</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo (USD)</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_INSUMOS.filter(k => costoInsumos[k] > 0).map(k =>
                  filaCategoriaProducto(k, costoInsumos[k], totalInsumosDesglose, productosInsumos[k] ?? [])
                )}
                {totalInsumosDesglose === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Costo de Servicios por Categoría</h2>
            <p className="text-xs text-campo-400 mt-0.5">Clic en una fila para ver el detalle por lote</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Categoría</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo (USD)</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_SERVICIOS.filter(k => costoServicios[k] > 0).map(k =>
                  filaCategoriaLote('servicios', k, costoServicios[k], totalServiciosDesglose, detalleServicios[k] ?? [], fmtUsd)
                )}
                {totalServiciosDesglose === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Hectáreas Trabajadas por Actividad</h2>
            <p className="text-xs text-campo-400 mt-0.5">Clic en una fila para ver el detalle por lote</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Actividad</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Ha</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {ORDEN_HECTAREAS.filter(k => haTrabajadasDesglose[k] > 0).map(k =>
                  filaCategoriaLote('hectareas', k, haTrabajadasDesglose[k], haTrabajadas, detalleHectareas[k] ?? [], fmt)
                )}
                {haTrabajadas === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100">
            <h2 className="font-semibold text-campo-900">Costos Fijos por Categoría</h2>
            <p className="text-xs text-campo-400 mt-0.5">Clic en una fila para ver el detalle por lote</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-5 py-2 font-semibold text-campo-700">Categoría</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">Costo (USD)</th>
                  <th className="text-right px-5 py-2 font-semibold text-campo-700">%</th>
                </tr>
              </thead>
              <tbody>
                {categoriasCostoFijos.filter(k => costoFijos[k] > 0).map(k =>
                  filaCategoriaLote('fijos', k, costoFijos[k], totalCostoFijosDesglose, detalleCostoFijos[k] ?? [], fmtUsd)
                )}
                {totalCostoFijosDesglose === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-campo-400">Sin datos para esta campaña</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Resumen por cultivo */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100">
          <h2 className="font-semibold text-campo-900">Resumen por Cultivo — {campanaActual}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Lotes</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Producción (kg)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde (kg/ha)</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo/ha (USD)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(porCultivo).length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay ciclos para esta campaña</td></tr>
              )}
              {Object.entries(porCultivo).map(([cultivo, data]: [string, any]) => (
                <tr key={cultivo} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{cultivo}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{data.lotes}</td>
                  <td className="px-5 py-3 text-right text-campo-700">{fmt(data.haSembrada)}</td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.haCosechada > 0 ? fmt(data.haCosechada) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.kg > 0 ? fmt(data.kg) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-campo-900">
                    {data.haCosechada > 0 ? fmt(data.kg / data.haCosechada) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-campo-700">
                    {data.haSembrada > 0 ? fmtUsd(data.costo / data.haSembrada) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-campo-900">Lotes — {campanaActual}</h2>
            {seleccion && (
              <p className="text-xs text-lime-700 mt-0.5">
                Filtrado por: {seleccion.categoria} ({cicloIdsSeleccion.size} lotes) ·{' '}
                <button onClick={() => setSeleccion(null)} className="underline hover:text-lime-600">quitar filtro</button>
              </p>
            )}
          </div>
          <a href="/seguimiento/lotes" className="text-sm text-lime-700 hover:text-lime-600 font-medium">Ver todos →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Lote</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campo</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha sembradas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Ha cosechadas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Rinde kg/ha</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo USD</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const base = seleccion ? ciclosCampana.filter(r => cicloIdsSeleccion.has(r.ciclo_id)) : ciclosCampana.slice(0, 10)
                if (base.length === 0) {
                  return <tr><td colSpan={7} className="px-5 py-10 text-center text-campo-400">No hay lotes para mostrar</td></tr>
                }
                return base.map((r, i) => {
                  const costoLote = Number(r.costo_semillas_usd ?? 0) + Number(r.costo_insumos_usd ?? 0) +
                    Number(r.costo_fertilizantes_usd ?? 0) + Number(r.costo_servicios_usd ?? 0) +
                    Number(r.costo_fijos_usd ?? 0)
                  return (
                    <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-campo-900">{r.lote}</td>
                      <td className="px-5 py-3 text-campo-500 text-xs">{r.campo}</td>
                      <td className="px-5 py-3 text-campo-700">{r.cultivo}</td>
                      <td className="px-5 py-3 text-right text-campo-700">{fmt(r.sup_sembrada ?? r.hectareas)}</td>
                      <td className="px-5 py-3 text-right text-campo-700">
                        {r.sup_cosechada ? fmt(r.sup_cosechada) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-campo-900">
                        {r.rinde_kg_ha ? fmt(r.rinde_kg_ha) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-campo-700">{fmtUsd(costoLote)}</td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
