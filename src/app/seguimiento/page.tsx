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
    // Supabase/PostgREST tiene un tope máximo de filas por respuesta (por defecto 1000),
    // que ignora el .limit() que pidamos desde el cliente. Si una tabla supera esa
    // cantidad de filas (como sa_aplicacion_productos), hay que paginar con .range()
    // para traer todo, si no se pierden filas de forma silenciosa y aleatoria.
    async function fetchAll<T>(tabla: string, columnas: string): Promise<T[]> {
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

    async function cargar() {
      setLoading(true)
      const [
        cs, caps,
        acon, siem, apls, aplProds,
        fert, cos, resi,
        cfDirectos, cfDistribuidos,
      ] = await Promise.all([
        fetchAll<Resumen>('vw_sa_resumen_ciclo', '*'),
        fetchAll<{ nombre: string }>('campanas', 'nombre'),
        fetchAll<Acondicionamiento>('sa_acondicionamiento', 'ciclo_id, fecha, superficie_ha, costo_usd_ha'),
        fetchAll<Siembra>('sa_siembras', 'ciclo_id, fecha, costo_semilla_total, costo_servicio_total, hibrido_1, sup_hibrido_1, cu_hibrido_1, hibrido_2, sup_hibrido_2, cu_hibrido_2, hibrido_3, sup_hibrido_3, cu_hibrido_3, densidad, unidad_densidad, fertilizante_1, fertilizante_1_kg_ha, fertilizante_1_costo_kg, fertilizante_2, fertilizante_2_kg_ha, fertilizante_2_costo_kg'),
        fetchAll<Aplicacion>('sa_aplicaciones', 'id, ciclo_id, fecha, tipo, superficie_ha, costo_servicio_usd_ha'),
        fetchAll<AplicacionProducto>('sa_aplicacion_productos', 'aplicacion_id, producto, unidad, dosis_ha, costo_unitario'),
        fetchAll<Fertilizacion>('sa_fertilizaciones', 'ciclo_id, fecha, tipo_fertilizante, cantidad_ha, superficie_ha, costo_usd_ha, costo_servicio_usd_ha'),
        fetchAll<Cosecha>('sa_cosechas', 'ciclo_id, fecha, superficie_ha, costo_cosecha_usd_ha'),
        fetchAll<Resiembra>('sa_resiembras', 'ciclo_id, fecha, superficie_ha'),
        fetchAll<CostoFijoDirecto>('sa_costos_fijos', 'ciclo_id, tipo, costo_total_usd'),
        fetchAll<CostoFijoDistribuido>('vw_distribucion_costos_fijos', 'ciclo_id, tipo, costo_ciclo'),
      ])
      const nombres = Array.from(new Set((caps ?? []).map((c: any) => c.nombre))).sort().reverse()
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
  const costo