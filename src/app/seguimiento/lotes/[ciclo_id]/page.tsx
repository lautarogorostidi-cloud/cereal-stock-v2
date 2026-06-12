'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type Ciclo = {
  ciclo_id: number
  campana: string
  lote: string
  campo: string
  hectareas: number
  cultivo: string
  sup_sembrada: number
  propiedad: string
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

type Aplicacion = {
  id: number
  tipo: string
  numero: number
  fecha: string | null
  superficie_ha: number
  costo_servicio_usd_ha: number | null
  productos: Producto[]
}

type Producto = {
  id: number
  producto: string
  dosis_ha: number
  unidad: string | null
  costo_unitario: number
}

type Siembra = {
  id: number
  fecha: string | null
  sistema: string | null
  hibrido_1: string | null
  sup_hibrido_1: number | null
  densidad: number | null
  unidad_densidad: string | null
  costo_servicio_usd_ha: number | null
  costo_servicio_total: number | null
  costo_semilla_total: number | null
  fertilizante_1: string | null
  fertilizante_1_kg_ha: number | null
  fertilizante_1_costo_kg: number | null
  fertilizante_2: string | null
  fertilizante_2_kg_ha: number | null
  fertilizante_2_costo_kg: number | null
}

type Fertilizacion = {
  id: number
  numero: number
  fecha: string | null
  tipo_fertilizante: string | null
  cantidad_ha: number | null
  superficie_ha: number | null
  costo_usd_ha: number | null
  costo_servicio_usd_ha: number | null
}

type Cosecha = {
  id: number
  fecha: string | null
  superficie_ha: number | null
  rinde_kg_ha_cosecha: number | null
  rinde_kg_total: number | null
  costo_cosecha_usd_ha: number | null
}

type CostoFijo = {
  id: number
  tipo: string
  costo_usd_ha: number | null
  costo_total_usd: number
}

const fmt = (n: number | null | undefined, dec = 1) =>
  n != null ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'

const fmtUsd = (n: number | null | undefined) =>
  n != null ? `USD ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'

const fmtFecha = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

const TIPO_LABELS: Record<string, string> = {
  barbecho: 'Barbecho',
  pre_siembra: 'Pre-siembra incorporado',
  pre_emergente: 'Pre-Emergente',
  post_emergente_temprano: 'Post-Emergente Temprano',
  post_emergente: 'Post-Emergente',
  rescate: 'Aplicación de Rescate',
  desecacion: 'Desecación Pre-cosecha',
  insecticida: 'Insecticida',
  fungicida: 'Fungicida',
}

const TIPO_COLORS: Record<string, string> = {
  barbecho: 'bg-amber-100 text-amber-800',
  pre_siembra: 'bg-yellow-100 text-yellow-800',
  pre_emergente: 'bg-lime-100 text-lime-800',
  post_emergente_temprano: 'bg-emerald-100 text-emerald-800',
  post_emergente: 'bg-green-100 text-green-800',
  rescate: 'bg-orange-100 text-orange-800',
  desecacion: 'bg-stone-100 text-stone-800',
  insecticida: 'bg-red-100 text-red-800',
  fungicida: 'bg-purple-100 text-purple-800',
}

const TIPO_FIJO_LABELS: Record<string, string> = {
  arrendamiento: 'Arrendamiento',
  asesor: 'Asesoramiento',
  seguro: 'Seguro',
}

const TIPOS_ORDEN = [
  'barbecho', 'pre_siembra', 'pre_emergente',
  'post_emergente_temprano', 'post_emergente',
  'rescate', 'desecacion', 'insecticida', 'fungicida',
]

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
        <h2 className="font-semibold text-campo-900">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-campo-400 text-sm text-center py-4">{msg}</p>
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-campo-900">{value}</div>
      {sub && <div className="text-xs text-campo-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function FichaCicloPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const supabase = createClient()
  const router = useRouter()

  const [ciclo, setCiclo] = useState<Ciclo | null>(null)
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [siembra, setSiembra] = useState<Siembra | null>(null)
  const [fertilizaciones, setFertilizaciones] = useState<Fertilizacion[]>([])
  const [cosecha, setCosecha] = useState<Cosecha | null>(null)
  const [costosFijos, setCostosFijos] = useState<CostoFijo[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingCiclo, setDeletingCiclo] = useState(false)

  useEffect(() => {
    if (!ciclo_id) return
    cargar()
  }, [ciclo_id])

  async function cargar() {
    setLoading(true)
    const id = Number(ciclo_id)

    const [
      { data: cicloData },
      { data: apls },
      { data: siembraData },
      { data: fertData },
      { data: cosechaData },
      { data: fijosData },
    ] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('*').eq('ciclo_id', id).single(),
      supabase.from('sa_aplicaciones').select('*').eq('ciclo_id', id).order('fecha').order('tipo'),
      supabase.from('sa_siembras').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('sa_fertilizaciones').select('*').eq('ciclo_id', id).order('numero'),
      supabase.from('sa_cosechas').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('sa_costos_fijos').select('*').eq('ciclo_id', id).order('tipo'),
    ])

    const aplIds = (apls ?? []).map((a: any) => a.id as number)
    const { data: prods } = aplIds.length > 0
      ? await supabase.from('sa_aplicacion_productos').select('*').in('aplicacion_id', aplIds)
      : { data: [] }

    setCiclo(cicloData ?? null)
    setAplicaciones((apls ?? []).map((a: any) => ({
      ...a,
      productos: (prods ?? []).filter((p: any) => p.aplicacion_id === a.id),
    })))
    setSiembra(siembraData ?? null)
    setFertilizaciones(fertData ?? [])
    setCosecha(cosechaData ?? null)
    setCostosFijos(fijosData ?? [])
    setLoading(false)
  }

  async function handleBorrarAplicacion(aplId: number) {
    if (!confirm('¿Seguro que querés borrar esta aplicación y todos sus productos?')) return
    setDeletingId(aplId)
    await supabase.from('sa_aplicacion_productos').delete().eq('aplicacion_id', aplId)
    await supabase.from('sa_aplicaciones').delete().eq('id', aplId)
    setDeletingId(null)
    cargar()
  }

  async function handleBorrarCiclo() {
    if (!confirm('¿Seguro que querés borrar este ciclo? Se borrarán también todas sus aplicaciones, siembra, cosecha y costos.')) return
    setDeletingCiclo(true)
    const id = Number(ciclo_id)
    // Borrar productos de aplicaciones
    const { data: apls } = await supabase.from('sa_aplicaciones').select('id').eq('ciclo_id', id)
    if (apls && apls.length > 0) {
      await supabase.from('sa_aplicacion_productos').delete().in('aplicacion_id', apls.map((a: any) => a.id))
    }
    await supabase.from('sa_aplicaciones').delete().eq('ciclo_id', id)
    await supabase.from('sa_siembras').delete().eq('ciclo_id', id)
    await supabase.from('sa_fertilizaciones').delete().eq('ciclo_id', id)
    await supabase.from('sa_cosechas').delete().eq('ciclo_id', id)
    await supabase.from('sa_costos_fijos').delete().eq('ciclo_id', id)
    await supabase.from('sa_ciclos').delete().eq('id', id)
    router.push('/seguimiento/lotes')
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  const costoInsumos = Number(ciclo.costo_semillas_usd ?? 0) + Number(ciclo.costo_insumos_usd ?? 0) + Number(ciclo.costo_fertilizantes_usd ?? 0)
  const costoServicios = Number(ciclo.costo_servicios_usd ?? 0)
  const totalFijos = costosFijos.reduce((acc, f) => acc + Number(f.costo_total_usd), 0)
  const costoTotal = costoInsumos + costoServicios + totalFijos

  const arrendamiento = costosFijos.find(f => f.tipo === 'arrendamiento')
  const asesor = costosFijos.find(f => f.tipo === 'asesor')
  const seguro = costosFijos.find(f => f.tipo === 'seguro')

  const aplPorTipo = aplicaciones.reduce((acc: Record<string, Aplicacion[]>, a) => {
    if (!acc[a.tipo]) acc[a.tipo] = []
    acc[a.tipo].push(a)
    return acc
  }, {})

  const unidadDensidad = siembra?.unidad_densidad === 'pl_ha' ? 'pl/ha' : 'kg/ha'

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between">
        <div>
          <Link href="/seguimiento/lotes" className="text-sm text-campo-400 hover:text-campo-700">← Lotes</Link>
          <h1 className="text-2xl font-bold text-campo-900 mt-1">{ciclo.lote}</h1>
          <p className="text-campo-500 text-sm mt-0.5">{ciclo.campo} · {ciclo.campana} · {ciclo.propiedad}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/seguimiento/lotes/nuevo?lote=${(ciclo as any).lote_id ?? ''}&ciclo=${ciclo_id}`}
            className="text-xs text-lime-700 hover:text-lime-600 font-medium px-3 py-1.5 rounded-lg border border-lime-200 hover:bg-lime-50 transition-colors"
          >
            Editar ciclo
          </Link>
          <button
            onClick={handleBorrarCiclo}
            disabled={deletingCiclo}
            className="text-xs text-red-400 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deletingCiclo ? 'Borrando...' : 'Borrar ciclo'}
          </button>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-lime-100 text-lime-800">
            {ciclo.cultivo}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <KPI label="Superficie" value={`${fmt(ciclo.sup_sembrada ?? ciclo.hectareas)} ha`} />
        <div className="card p-4 lg:col-span-3">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-3">Costos Fijos</div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-campo-500 mb-0.5">Arrendamiento</div>
              <div className="text-lg font-bold text-campo-900">{fmtUsd(arrendamiento?.costo_total_usd)}</div>
            </div>
            <div>
              <div className="text-xs text-campo-500 mb-0.5">Asesoramiento</div>
              <div className="text-lg font-bold text-campo-900">{fmtUsd(asesor?.costo_total_usd)}</div>
            </div>
            <div>
              <div className="text-xs text-campo-500 mb-0.5">Seguro</div>
              <div className="text-lg font-bold text-campo-900">{fmtUsd(seguro?.costo_total_usd)}</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-campo-100 text-xs text-campo-500">
            Total fijos: <span className="font-semibold text-campo-900">{fmtUsd(totalFijos)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KPI label="Costo Insumos" value={fmtUsd(costoInsumos)} sub="semillas + fertilizantes + fitosanitarios" />
        <KPI label="Costo Servicios" value={fmtUsd(costoServicios)} sub="siembra + pulverización + cosecha" />
        <KPI label="Costo Total" value={fmtUsd(costoTotal)} sub="insumos + servicios + fijos" />
      </div>

      <Section title="Siembra" action={
        <Link
          href={`/seguimiento/lotes/${ciclo_id}/siembra`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-lime-700 hover:text-lime-600 font-medium"
        >
          {siembra ? 'Editar' : '+ Agregar'}
        </Link>
      }>
        {!siembra ? <Empty msg="Sin datos de siembra" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-campo-500">Cultivo</span>
              <div className="font-medium text-campo-900 mt-0.5">{ciclo.cultivo}</div>
            </div>
            <div>
              <span className="text-campo-500">Fecha</span>
              <div className="font-medium text-campo-900 mt-0.5">{fmtFecha(siembra.fecha)}</div>
            </div>
            <div>
              <span className="text-campo-500">Sistema</span>
              <div className="font-medium text-campo-900 mt-0.5">{siembra.sistema ?? '—'}</div>
            </div>
            <div>
              <span className="text-campo-500">Híbrido / Variedad</span>
              <div className="font-medium text-campo-900 mt-0.5">{siembra.hibrido_1 ?? '—'}</div>
            </div>
            <div>
              <span className="text-campo-500">Densidad</span>
              <div className="font-medium text-campo-900 mt-0.5">
                {siembra.densidad != null ? `${fmt(siembra.densidad, 0)} ${unidadDensidad}` : '—'}
              </div>
            </div>
            <div>
              <span className="text-campo-500">Serv. siembra</span>
              <div className="font-medium text-campo-900 mt-0.5">{fmtUsd(siembra.costo_servicio_total)}</div>
            </div>
            <div>
              <span className="text-campo-500">Costo semilla</span>
              <div className="font-medium text-campo-900 mt-0.5">{fmtUsd(siembra.costo_semilla_total)}</div>
            </div>
            {siembra.fertilizante_1 && (
              <div>
                <span className="text-campo-500">Fertilizante 1</span>
                <div className="font-medium text-campo-900 mt-0.5">
                  {siembra.fertilizante_1}
                  {siembra.fertilizante_1_kg_ha ? ` — ${fmt(siembra.fertilizante_1_kg_ha, 0)} kg/ha` : ''}
                  {siembra.fertilizante_1_costo_kg && siembra.fertilizante_1_kg_ha && siembra.sup_hibrido_1
                    ? ` · ${fmtUsd(siembra.fertilizante_1_kg_ha * siembra.sup_hibrido_1 * siembra.fertilizante_1_costo_kg)}`
                    : ''}
                </div>
              </div>
            )}
            {siembra.fertilizante_2 && (
              <div>
                <span className="text-campo-500">Fertilizante 2</span>
                <div className="font-medium text-campo-900 mt-0.5">
                  {siembra.fertilizante_2}
                  {siembra.fertilizante_2_kg_ha ? ` — ${fmt(siembra.fertilizante_2_kg_ha, 0)} kg/ha` : ''}
                  {siembra.fertilizante_2_costo_kg && siembra.fertilizante_2_kg_ha && siembra.sup_hibrido_1
                    ? ` · ${fmtUsd(siembra.fertilizante_2_kg_ha * siembra.sup_hibrido_1 * siembra.fertilizante_2_costo_kg)}`
                    : ''}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Aplicaciones" action={
        <Link
          href={`/seguimiento/lotes/${ciclo_id}/aplicaciones/nueva`}
          className="text-xs text-lime-700 hover:text-lime-600 font-medium"
          target="_blank"
          rel="noopener noreferrer"
        >
          + Agregar
        </Link>
      }>
        {aplicaciones.length === 0 ? <Empty msg="Sin aplicaciones registradas" /> : (
          <div className="space-y-5">
            {TIPOS_ORDEN.filter(t => aplPorTipo[t]).map(tipo => (
              <div key={tipo}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[tipo] ?? 'bg-gray-100 text-gray-800'}`}>
                    {TIPO_LABELS[tipo] ?? tipo}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-campo-100 bg-campo-50">
                        <th className="text-left px-4 py-2 font-semibold text-campo-700">Fecha</th>
                        <th className="text-right px-4 py-2 font-semibold text-campo-700">Sup. (ha)</th>
                        <th className="text-right px-4 py-2 font-semibold text-campo-700">Serv. USD/ha</th>
                        <th className="text-left px-4 py-2 font-semibold text-campo-700">Productos</th>
                        <th className="text-right px-4 py-2 font-semibold text-campo-700">Total insumos</th>
                        <th className="text-center px-4 py-2 font-semibold text-campo-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aplPorTipo[tipo].map(a => {
                        const totalInsumos = a.productos.reduce(
                          (acc, p) => acc + p.dosis_ha * a.superficie_ha * p.costo_unitario, 0
                        )
                        return (
                          <tr key={a.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                            <td className="px-4 py-2 text-campo-700">{fmtFecha(a.fecha)}</td>
                            <td className="px-4 py-2 text-right text-campo-700">{fmt(a.superficie_ha)}</td>
                            <td className="px-4 py-2 text-right text-campo-700">{fmt(a.costo_servicio_usd_ha, 2)}</td>
                            <td className="px-4 py-2 text-campo-600 text-xs">
                              {a.productos.map(p => (
                                <span key={p.id} className="inline-block mr-3 mb-0.5">
                                  <span className="font-medium text-campo-800">{p.producto}</span>
                                  <span className="text-campo-400 ml-1">
                                    {fmt(p.dosis_ha, 2)} {p.unidad ?? ''}/ha · USD {fmt(p.costo_unitario, 2)}/{p.unidad ?? 'u'}
                                  </span>
                                </span>
                              ))}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(totalInsumos)}</td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Link
                                  href={`/seguimiento/lotes/${ciclo_id}/aplicaciones/${a.id}/editar`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-lime-700 hover:text-lime-600 font-medium"
                                >
                                  Editar
                                </Link>
                                <button
                                  onClick={() => handleBorrarAplicacion(a.id)}
                                  disabled={deletingId === a.id}
                                  className="text-xs text-red-400 hover:text-red-600 font-medium disabled:opacity-50"
                                >
                                  {deletingId === a.id ? '...' : 'Borrar'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Fertilizaciones" action={
        <button className="text-xs text-lime-700 hover:text-lime-600 font-medium">+ Agregar</button>
      }>
        {fertilizaciones.length === 0 ? <Empty msg="Sin fertilizaciones registradas" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Fecha</th>
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Tipo</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">kg/ha</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Sup. (ha)</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Insumo USD/ha</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Serv. USD/ha</th>
                </tr>
              </thead>
              <tbody>
                {fertilizaciones.map(f => (
                  <tr key={f.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-4 py-2 text-campo-700">{fmtFecha(f.fecha)}</td>
                    <td className="px-4 py-2 text-campo-700">{f.tipo_fertilizante ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.cantidad_ha, 0)}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.superficie_ha)}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.costo_usd_ha, 2)}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.costo_servicio_usd_ha, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Cosecha" action={
        <button className="text-xs text-lime-700 hover:text-lime-600 font-medium">
          {cosecha ? 'Editar' : '+ Agregar'}
        </button>
      }>
        {!cosecha ? <Empty msg="Sin datos de cosecha" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-campo-500">Fecha</span><div className="font-medium text-campo-900 mt-0.5">{fmtFecha(cosecha.fecha)}</div></div>
            <div><span className="text-campo-500">Superficie</span><div className="font-medium text-campo-900 mt-0.5">{fmt(cosecha.superficie_ha)} ha</div></div>
            <div><span className="text-campo-500">Rinde</span><div className="font-medium text-campo-900 mt-0.5">{fmt(cosecha.rinde_kg_ha_cosecha)} kg/ha</div></div>
            <div><span className="text-campo-500">Total</span><div className="font-medium text-campo-900 mt-0.5">{fmt(cosecha.rinde_kg_total, 0)} kg</div></div>
            <div><span className="text-campo-500">Costo cosecha</span><div className="font-medium text-campo-900 mt-0.5">{fmtUsd((cosecha.costo_cosecha_usd_ha ?? 0) * (cosecha.superficie_ha ?? 0))}</div></div>
          </div>
        )}
      </Section>

      <Section title="Costos Fijos" action={
        <button className="text-xs text-lime-700 hover:text-lime-600 font-medium">+ Agregar</button>
      }>
        {costosFijos.length === 0 ? <Empty msg="Sin costos fijos registrados" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-campo-100 bg-campo-50">
                  <th className="text-left px-4 py-2 font-semibold text-campo-700">Tipo</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">USD/ha</th>
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Total USD</th>
                </tr>
              </thead>
              <tbody>
                {costosFijos.map(f => (
                  <tr key={f.id} className="border-b border-campo-50 hover:bg-campo-50/50">
                    <td className="px-4 py-2 text-campo-700">{TIPO_FIJO_LABELS[f.tipo] ?? f.tipo}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.costo_usd_ha, 2)}</td>
                    <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(f.costo_total_usd)}</td>
                  </tr>
                ))}
                <tr className="bg-campo-50">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-campo-700">Total</td>
                  <td className="px-4 py-2 text-right font-bold text-campo-900">{fmtUsd(totalFijos)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

    </div>
  )
}