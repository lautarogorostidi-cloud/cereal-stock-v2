'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type ConsumoMaquina = {
  maquina_id: number
  maquina: string
  tipo: string
  marca: string | null
  modelo: string | null
  patente_interno: string | null
  activo: boolean
  litros_totales: number
  cargas: number
  ultima_carga: string | null
}

type MovimientoConsumo = {
  fecha: string
  litros: number
  combustible_maquinas: { nombre: string; tipo: string } | null
}

type IngresoCampana = {
  campania_id: number
  campania: string
  combustible: string | null
  litros_ingresados: number
  costo_total: number
  cargas: number
}

const TIPOS_MAQUINA_ORDEN = ['tractor', 'cosechadora', 'pulverizadora', 'camioneta', 'camion', 'otro']
const TIPO_COLORES: Record<string, string> = {
  tractor: '#059669',
  cosechadora: '#f59e0b',
  pulverizadora: '#3b82f6',
  camioneta: '#8b5cf6',
  camion: '#ef4444',
  otro: '#6b7280',
}

export default function ReportesCombustiblePage() {
  const supabase = createClient()
  const [consumoMaquinas, setConsumoMaquinas] = useState<ConsumoMaquina[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoConsumo[]>([])
  const [ingresosCampana, setIngresosCampana] = useState<IngresoCampana[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: cm }, { data: movs }, { data: ic }] = await Promise.all([
      supabase.from('vw_consumo_combustible_maquinas').select('*').order('litros_totales', { ascending: false }),
      supabase.from('combustible_movimientos').select('fecha, litros, combustible_maquinas(nombre, tipo)').eq('tipo', 'consumo'),
      supabase.from('vw_combustible_ingresos_campania').select('*'),
    ])
    setConsumoMaquinas((cm ?? []).filter((m: any) => m.activo))
    setMovimientos((movs ?? []) as any)
    setIngresosCampana((ic ?? []) as any)
    setLoading(false)
  }

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })
  const fmtUsd = (n: number) => `USD ${Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

  // Consumo mensual, desglosado por tipo de máquina (para ver dónde más se gasta)
  const { datosMensuales, tiposEnDatos } = useMemo(() => {
    const porMes: Record<string, Record<string, number>> = {}
    const tipos = new Set<string>()
    movimientos.forEach(m => {
      const d = new Date(m.fecha + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const tipo = m.combustible_maquinas?.tipo ?? 'otro'
      tipos.add(tipo)
      if (!porMes[key]) porMes[key] = {}
      porMes[key][tipo] = (porMes[key][tipo] ?? 0) + Number(m.litros ?? 0)
    })
    const tiposOrdenados = TIPOS_MAQUINA_ORDEN.filter(t => tipos.has(t))
    const datos = Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, porTipo]) => {
        const [anio, mes] = key.split('-')
        const label = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
        const fila: Record<string, string | number> = { key, label }
        tiposOrdenados.forEach(t => { fila[t] = Math.round(porTipo[t] ?? 0) })
        return fila
      })
    return { datosMensuales: datos, tiposEnDatos: tiposOrdenados }
  }, [movimientos])

  const totalConsumido = consumoMaquinas.reduce((acc, m) => acc + Number(m.litros_totales ?? 0), 0)
  const totalCargas = consumoMaquinas.reduce((acc, m) => acc + Number(m.cargas ?? 0), 0)

  const filtradas = consumoMaquinas.filter(m => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return m.maquina.toLowerCase().includes(q) || m.marca?.toLowerCase().includes(q)
  })

  const totalIngresosLitros = ingresosCampana.reduce((acc, c) => acc + Number(c.litros_ingresados ?? 0), 0)
  const totalIngresosCosto = ingresosCampana.reduce((acc, c) => acc + Number(c.costo_total ?? 0), 0)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-campo-200 rounded-lg px-4 py-3 shadow-lg text-sm space-y-1">
        <div className="font-semibold text-campo-900 mb-1">{label}</div>
        {payload.filter((p: any) => p.value > 0).map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-campo-600 capitalize">{p.dataKey}:</span>
            <span className="font-medium text-campo-900">{fmt(p.value)} L</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes de Combustible</h1>
        <p className="text-campo-500 text-sm mt-0.5">Consumo por máquina, evolución mensual e ingresos por campaña</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Litros consumidos</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalConsumido)}</div>
          <div className="text-xs text-campo-400 mt-0.5">total histórico</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Cargas registradas</div>
          <div className="text-2xl font-bold text-campo-900">{totalCargas}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Máquinas con consumo</div>
          <div className="text-2xl font-bold text-campo-900">{consumoMaquinas.filter(m => m.litros_totales > 0).length}</div>
        </div>
      </div>

      {/* Gráfico mensual, apilado por tipo de máquina */}
      <div className="card p-6">
        <h2 className="font-semibold text-campo-900 mb-1">Consumo mensual por tipo de máquina</h2>
        <p className="text-xs text-campo-400 mb-4">Para ver dónde se gasta más combustible cada mes</p>
        {datosMensuales.length === 0 ? (
          <div className="text-center text-campo-400 py-10">Sin consumos registrados todavía</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={datosMensuales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, textTransform: 'capitalize' }} />
              {tiposEnDatos.map((tipo, i) => (
                <Bar key={tipo} dataKey={tipo} name={tipo} stackId="consumo" fill={TIPO_COLORES[tipo] ?? '#6b7280'}
                  radius={i === tiposEnDatos.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Ingresos por campaña */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-campo-100">
          <h2 className="font-semibold text-campo-900">Ingresos (compras) por campaña</h2>
          <p className="text-xs text-campo-400 mt-0.5">Litros y costo comprado, agrupado por campaña</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Campaña</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Combustible</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Litros ingresados</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Costo total</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Cargas</th>
              </tr>
            </thead>
            <tbody>
              {ingresosCampana.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-campo-400">No hay ingresos con campaña asignada todavía</td></tr>
              )}
              {ingresosCampana.map((c, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{c.campania}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{c.combustible ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-campo-900">{fmt(c.litros_ingresados)} L</td>
                  <td className="px-5 py-3 text-right text-campo-600">{fmtUsd(c.costo_total)}</td>
                  <td className="px-5 py-3 text-right text-campo-600">{c.cargas}</td>
                </tr>
              ))}
              {ingresosCampana.length > 0 && (
                <tr className="border-t-2 border-campo-200 font-semibold">
                  <td className="px-5 py-3 text-campo-900">Total</td>
                  <td className="px-5 py-3"></td>
                  <td className="px-5 py-3 text-right text-campo-900">{fmt(totalIngresosLitros)} L</td>
                  <td className="px-5 py-3 text-right text-campo-900">{fmtUsd(totalIngresosCosto)}</td>
                  <td className="px-5 py-3"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla por máquina */}
      <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar máquina..."
        className="w-full rounded-lg border border-campo-200 px-4 py-2 text-sm text-campo-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Máquina</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Tipo</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Litros totales</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Cargas</th>
                <th className="text-right px-5 py-3 font-semibold text-campo-700">Promedio/carga</th>
                <th className="text-left px-5 py-3 font-semibold text-campo-700">Última carga</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-campo-400">No hay máquinas con consumo registrado</td></tr>}
              {filtradas.map(m => (
                <tr key={m.maquina_id} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-campo-900">{m.maquina}</td>
                  <td className="px-5 py-3 text-campo-600 capitalize">{m.tipo}</td>
                  <td className="px-5 py-3 text-right font-semibold text-campo-900">{fmt(m.litros_totales)} L</td>
                  <td className="px-5 py-3 text-right text-campo-600">{m.cargas}</td>
                  <td className="px-5 py-3 text-right text-campo-600">
                    {m.cargas > 0 ? `${fmt(m.litros_totales / m.cargas)} L` : '—'}
                  </td>
                  <td className="px-5 py-3 text-campo-600">
                    {m.ultima_carga ? new Date(m.ultima_carga + 'T00:00:00').toLocaleDateString('es-AR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
