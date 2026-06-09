'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  costo_unitario: number
}

type Siembra = {
  id: number
  fecha: string | null
  sistema: string | null
  hibrido_1: string | null
  sup_hibrido_1: number | null
  densidad: number | null
  costo_servicio_usd_ha: number | null
  costo_servicio_total: number | null
  costo_semilla_total: number | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, dec = 1) =>
  n != null ? Number(n).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—'

const fmtUsd = (n: number | null | undefined) =>
  n != null ? `USD ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'

const fmtFecha = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'

const TIPO_LABELS: Record<string, string> = {
  barbecho: 'Barbecho',
  pre_emergente: 'Pre-Emergente',
  post_emergente: 'Post-Emergente',
  insecticida: 'Insecticida',
  fungicida: 'Fungicida',
  coadyuvante: 'Coadyuvante',
}

const TIPO_COLORS: Record<string, string> = {
  barbecho: 'bg-amber-100 text-amber-800',
  pre_emergente: 'bg-lime-100 text-lime-800',
  post_emergente: 'bg-green-100 text-green-800',
  insecticida: 'bg-red-100 text-red-800',
  fungicida: 'bg-purple-100 text-purple-800',
  coadyuvante: 'bg-blue-100 text-blue-800',
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FichaCicloPage() {
  const { ciclo_id } = useParams<{ ciclo_id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [ciclo, setCiclo] = useState<Ciclo | null>(null)
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([])
  const [siembra, setSiembra] = useState<Siembra | null>(null)
  const [fertilizaciones, setFertilizaciones] = useState<Fertilizacion[]>([])
  const [cosecha, setCosecha] = useState<Cosecha | null>(null)
  const [costosFijos, setCostosFijos] = useState<CostoFijo[]>([])
  const [loading, setLoading] = useState(true)

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
      { data: prods },
      { data: siembraData },
      { data: fertData },
      { data: cosechaData },
      { data: fijosData },
    ] = await Promise.all([
      supabase.from('vw_sa_resumen_ciclo').select('*').eq('ciclo_id', id).single(),
      supabase.from('sa_aplicaciones').select('*').eq('ciclo_id', id).order('tipo').order('numero'),
      supabase.from('sa_aplicacion_productos').select('*').in(
        'aplicacion_id',
        (apls ?? []).map((a: any) => a.id)
      ),
      supabase.from('sa_siembras').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('sa_fertilizaciones').select('*').eq('ciclo_id', id).order('numero'),
      supabase.from('sa_cosechas').select('*').eq('ciclo_id', id).maybeSingle(),
      supabase.from('sa_costos_fijos').select('*').eq('ciclo_id', id).order('tipo'),
    ])

    setCiclo(cicloData ?? null)

    // Merge productos into aplicaciones
    const aplsConProds: Aplicacion[] = (apls ?? []).map((a: any) => ({
      ...a,
      productos: (prods ?? []).filter((p: any) => p.aplicacion_id === a.id),
    }))
    setAplicaciones(aplsConProds)
    setSiembra(siembraData ?? null)
    setFertilizaciones(fertData ?? [])
    setCosecha(cosechaData ?? null)
    setCostosFijos(fijosData ?? [])
    setLoading(false)
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>
  if (!ciclo) return <div className="text-center text-campo-400 py-20">Ciclo no encontrado</div>

  const costoTotal =
    Number(ciclo.costo_semillas_usd ?? 0) +
    Number(ciclo.costo_insumos_usd ?? 0) +
    Number(ciclo.costo_fertilizantes_usd ?? 0) +
    Number(ciclo.costo_servicios_usd ?? 0) +
    Number(ciclo.costo_fijos_usd ?? 0)

  // Group aplicaciones by tipo
  const aplPorTipo = aplicaciones.reduce((acc: Record<string, Aplicacion[]>, a) => {
    if (!acc[a.tipo]) acc[a.tipo] = []
    acc[a.tipo].push(a)
    return acc
  }, {})

  const tiposOrden = ['barbecho', 'pre_emergente', 'post_emergente', 'insecticida', 'fungicida', 'coadyuvante']

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/seguimiento/lotes" className="text-sm text-campo-400 hover:text-campo-700">← Lotes</Link>
          </div>
          <h1 className="text-2xl font-bold text-campo-900">{ciclo.lote}</h1>
          <p className="text-campo-500 text-sm mt-0.5">{ciclo.campo} · {ciclo.campana} · {ciclo.propiedad}</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-lime-100 text-lime-800">
          {ciclo.cultivo}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Superficie</div>
          <div className="text-xl font-bold text-campo-900">{fmt(ciclo.sup_sembrada ?? ciclo.hectareas)} ha</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Siembra</div>
          <div className="text-xl font-bold text-campo-900">{fmtFecha(ciclo.fecha_siembra)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Cosecha</div>
          <div className="text-xl font-bold text-campo-900">{fmtFecha(ciclo.fecha_cosecha)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Rinde</div>
          <div className="text-xl font-bold text-campo-900">{fmt(ciclo.rinde_kg_ha)} kg/ha</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Costo Total</div>
          <div className="text-xl font-bold text-campo-900">{fmtUsd(costoTotal)}</div>
        </div>
      </div>

      {/* Siembra */}
      <Section title="Siembra" action={
        <button className="text-xs text-lime-700 hover:text-lime-600 font-medium">
          {siembra ? 'Editar' : '+ Agregar'}
        </button>
      }>
        {!siembra ? <Empty msg="Sin datos de siembra" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-campo-500">Fecha</span><div className="font-medium text-campo-900 mt-0.5">{fmtFecha(siembra.fecha)}</div></div>
            <div><span className="text-campo-500">Sistema</span><div className="font-medium text-campo-900 mt-0.5">{siembra.sistema ?? '—'}</div></div>
            <div><span className="text-campo-500">Híbrido</span><div className="font-medium text-campo-900 mt-0.5">{siembra.hibrido_1 ?? '—'}</div></div>
            <div><span className="text-campo-500">Densidad</span><div className="font-medium text-campo-900 mt-0.5">{fmt(siembra.densidad, 0)} pl/ha</div></div>
            <div><span className="text-campo-500">Serv. siembra</span><div className="font-medium text-campo-900 mt-0.5">{fmtUsd(siembra.costo_servicio_total)}</div></div>
            <div><span className="text-campo-500">Costo semilla</span><div className="font-medium text-campo-900 mt-0.5">{fmtUsd(siembra.costo_semilla_total)}</div></div>
          </div>
        )}
      </Section>

      {/* Aplicaciones */}
      <Section title="Aplicaciones" action={
        <button className="text-xs text-lime-700 hover:text-lime-600 font-medium">+ Agregar</button>
      }>
        {aplicaciones.length === 0 ? <Empty msg="Sin aplicaciones registradas" /> : (
          <div className="space-y-4">
            {tiposOrden.filter(t => aplPorTipo[t]).map(tipo => (
              <div key={tipo}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[tipo]}`}>
                    {TIPO_LABELS[tipo]}
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
                                <span key={p.id} className="inline-block mr-2">
                                  {p.producto} <span className="text-campo-400">({fmt(p.dosis_ha, 2)} × USD {fmt(p.costo_unitario, 2)})</span>
                                </span>
                              ))}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(totalInsumos)}</td>
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

      {/* Fertilizaciones */}
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
                  <th className="text-right px-4 py-2 font-semibold text-campo-700">Cantidad (kg/ha)</th>
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

      {/* Cosecha */}
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

      {/* Costos Fijos */}
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
                    <td className="px-4 py-2 capitalize text-campo-700">{f.tipo}</td>
                    <td className="px-4 py-2 text-right text-campo-700">{fmt(f.costo_usd_ha, 2)}</td>
                    <td className="px-4 py-2 text-right font-medium text-campo-900">{fmtUsd(f.costo_total_usd)}</td>
                  </tr>
                ))}
                <tr className="bg-campo-50">
                  <td colSpan={2} className="px-4 py-2 font-semibold text-campo-700">Total</td>
                  <td className="px-4 py-2 text-right font-bold text-campo-900">
                    {fmtUsd(costosFijos.reduce((acc, f) => acc + Number(f.costo_total_usd), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

    </div>
  )
}