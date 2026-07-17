'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type StockTanque = {
  tanque_id: number
  tanque: string
  stock_disponible: number
  capacidad_litros: number | null
  pct_ocupado: number | null
  activo: boolean
}

type Movimiento = {
  id: number
  tipo: string
  fecha: string
  litros: number
  combustible_tanques: { nombre: string } | null
  combustible_maquinas: { nombre: string } | null
}

export default function CombustibleDashboard() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockTanque[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: st }, { data: movs }] = await Promise.all([
      supabase.from('vw_stock_combustible').select('*'),
      supabase
        .from('combustible_movimientos')
        .select('id, tipo, fecha, litros, combustible_tanques(nombre), combustible_maquinas(nombre)')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .limit(8),
    ])
    setStock((st ?? []).filter((t: any) => t.activo))
    setMovimientos((movs ?? []) as any)
    setLoading(false)
  }

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const totalStock = stock.reduce((acc, t) => acc + Number(t.stock_disponible ?? 0), 0)
  const bajos = stock.filter(t => t.pct_ocupado !== null && t.pct_ocupado < 20).length

  const consumoMesActual = useMemo(() => {
    const hoy = new Date()
    return movimientos
      .filter(m => m.tipo === 'consumo')
      .filter(m => {
        const d = new Date(m.fecha + 'T00:00:00')
        return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
      })
      .reduce((acc, m) => acc + Number(m.litros ?? 0), 0)
  }, [movimientos])

  const badgeColor = (tipo: string) => {
    if (tipo === 'ingreso') return 'bg-blue-100 text-blue-700'
    if (tipo === 'consumo') return 'bg-orange-100 text-orange-700'
    return 'bg-campo-100 text-campo-600'
  }

  if (loading) return <div className="text-center text-campo-400 py-20">Cargando...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Dashboard Combustible</h1>
        <p className="text-campo-500 text-sm mt-0.5">Stock, ingresos y consumo de la maquinaria del campo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Tanques activos</div>
          <div className="text-2xl font-bold text-campo-900">{stock.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Stock total</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(totalStock)}</div>
          <div className="text-xs text-campo-400 mt-0.5">litros disponibles</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Consumido este mes</div>
          <div className="text-2xl font-bold text-campo-900">{fmt(consumoMesActual)}</div>
          <div className="text-xs text-campo-400 mt-0.5">litros</div>
        </div>
        <div className={`card p-5 ${bajos > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Tanques bajos</div>
          <div className={`text-2xl font-bold ${bajos > 0 ? 'text-red-600' : 'text-campo-900'}`}>{bajos}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo 20% de capacidad</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock por tanque */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
            <h2 className="font-semibold text-campo-900">Stock por tanque</h2>
            <Link href="/combustible/stock" className="text-sm text-lime-700 hover:text-lime-600 font-medium">Ver todo →</Link>
          </div>
          <div className="divide-y divide-campo-50">
            {stock.length === 0 && <div className="px-5 py-8 text-center text-campo-400 text-sm">No hay tanques activos</div>}
            {stock.map(t => (
              <div key={t.tanque_id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-campo-900">{t.tanque}</span>
                <span className="text-sm text-campo-600">
                  {fmt(t.stock_disponible)} L
                  {t.pct_ocupado !== null && <span className="text-xs text-campo-400"> ({t.pct_ocupado}%)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Últimos movimientos */}
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-campo-100 flex items-center justify-between">
            <h2 className="font-semibold text-campo-900">Últimos movimientos</h2>
            <Link href="/combustible/movimientos" className="text-sm text-lime-700 hover:text-lime-600 font-medium">Ver todo →</Link>
          </div>
          <div className="divide-y divide-campo-50">
            {movimientos.length === 0 && <div className="px-5 py-8 text-center text-campo-400 text-sm">No hay movimientos registrados</div>}
            {movimientos.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor(m.tipo)}`}>
                    {m.tipo}
                  </span>
                  <span className="text-campo-900">{m.combustible_tanques?.nombre ?? '—'}</span>
                  {m.combustible_maquinas?.nombre && <span className="text-campo-400">→ {m.combustible_maquinas.nombre}</span>}
                </div>
                <span className="text-campo-600">{fmt(m.litros)} L</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
