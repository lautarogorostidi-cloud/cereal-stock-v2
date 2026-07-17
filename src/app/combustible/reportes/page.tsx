'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  combustible_maquinas: { nombre: string } | null
}

export default function ReportesCombustiblePage() {
  const supabase = createClient()
  const [consumoMaquinas, setConsumoMaquinas] = useState<ConsumoMaquina[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoConsumo[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: cm }, { data: movs }] = await Promise.all([
      supabase.from('vw_consumo_combustible_maquinas').select('*').order('litros_totales', { ascending: false }),
      supabase.from('combustible_movimientos').select('fecha, litros, combustible_maquinas(nombre)').eq('tipo', 'consumo'),
    ])
    setConsumoMaquinas((cm ?? []).filter((m: any) => m.activo))
    setMovimientos((movs ?? []) as any)
    setLoading(false)
  }

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1 })

  // Consumo mensual total (últimos 12 meses con datos)
  const datosMensuales = useMemo(() => {
    const porMes: Record<string, number> = {}
    movimientos.forEach(m => {
      const d = new Date(m.fecha + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      porMes[key] = (porMes[key] ?? 0) + Number(m.litros ?? 0)
    })
    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, litros]) => {
        const [anio, mes] = key.split('-')
        const label = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
        return { key, label, litros: Math.round(litros) }
      })
  }, [movimientos])

  const totalConsumido = consumoMaquinas.reduce((acc, m) => acc + Number(m.litros_totales ?? 0), 0)
  const totalCargas = consumoMaquinas.reduce((acc, m) => acc + Number(m.cargas ?? 0), 0)

  const filtradas = consumoMaquinas.filter(m => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return m.maquina.toLowerCase().includes(q) || m.marca?.toLowerCase().includes(q)
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-campo-200 rounded-lg px-4 py-3 shadow-lg text-sm">
        <div className="font-semibold text-campo-900 mb-1">{label}</div>
        <div className="text-campo-600">{fmt(payload[0].value)} L consumidos</div>
      </div>
    )
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Reportes de Combustible</h1>
        <p className="text-campo-500 text-sm mt-0.5">Consumo por máquina y evolución mensual</p>
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

      {/* Gráfico mensual */}
      <div className="card p-6">
        <h2 className="font-semibold text-campo-900 mb-4">Consumo mensual (litros)</h2>
        {datosMensuales.length === 0 ? (
          <div className="text-center text-campo-400 py-10">Sin consumos registrados todavía</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datosMensuales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="litros" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
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
