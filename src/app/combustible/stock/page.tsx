'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StockTanque = {
  tanque_id: number
  tanque: string
  tipo: string
  combustible: string
  capacidad_litros: number | null
  ubicacion: string | null
  activo: boolean
  litros_ingresados: number
  litros_consumidos: number
  stock_disponible: number
  pct_ocupado: number | null
}

export default function StockCombustiblePage() {
  const supabase = createClient()
  const [stock, setStock] = useState<StockTanque[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('vw_stock_combustible').select('*').order('tanque')
    if (error) console.error('Error cargando stock:', error)
    setStock((data ?? []).filter((t: any) => t.activo))
    setLoading(false)
  }

  const fmt = (n: number) => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const totalStock = stock.reduce((acc, t) => acc + Number(t.stock_disponible ?? 0), 0)
  const totalCapacidad = stock.reduce((acc, t) => acc + Number(t.capacidad_litros ?? 0), 0)
  const bajos = stock.filter(t => t.pct_ocupado !== null && t.pct_ocupado < 20).length

  function colorBarra(pct: number | null) {
    if (pct === null) return 'bg-campo-400'
    if (pct < 20) return 'bg-red-500'
    if (pct < 40) return 'bg-orange-500'
    return 'bg-emerald-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-campo-900">Stock de Combustible</h1>
        <p className="text-campo-500 text-sm mt-0.5">Nivel actual por tanque</p>
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
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Capacidad total</div>
          <div className="text-2xl font-bold text-campo-900">{totalCapacidad > 0 ? fmt(totalCapacidad) : '—'}</div>
          <div className="text-xs text-campo-400 mt-0.5">litros de capacidad</div>
        </div>
        <div className={`card p-5 ${bajos > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <div className="text-xs font-semibold text-campo-500 uppercase tracking-wider mb-1">Tanques bajos</div>
          <div className={`text-2xl font-bold ${bajos > 0 ? 'text-red-600' : 'text-campo-900'}`}>{bajos}</div>
          <div className="text-xs text-campo-400 mt-0.5">bajo 20% de capacidad</div>
        </div>
      </div>

      {/* Tarjetas por tanque */}
      {loading && <div className="text-center text-campo-400 py-10">Cargando...</div>}
      {!loading && stock.length === 0 && (
        <div className="card p-12 text-center text-campo-400">No hay tanques activos registrados</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stock.map(t => (
          <div key={t.tanque_id} className="card p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-campo-900">{t.tanque}</div>
                <div className="text-xs text-campo-400 capitalize">{t.tipo === 'fijo' ? 'Fijo' : 'Móvil'} · {t.combustible}{t.ubicacion ? ` · ${t.ubicacion}` : ''}</div>
              </div>
              {t.pct_ocupado !== null && t.pct_ocupado < 20 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚠️ Bajo</span>
              )}
            </div>
            <div className="text-2xl font-bold text-campo-900 mt-3">
              {fmt(t.stock_disponible)} <span className="text-sm font-normal text-campo-400">L</span>
            </div>
            {t.capacidad_litros ? (
              <>
                <div className="w-full h-2 rounded-full bg-campo-100 mt-3 overflow-hidden">
                  <div className={`h-full rounded-full ${colorBarra(t.pct_ocupado)}`}
                    style={{ width: `${Math.min(100, Math.max(0, t.pct_ocupado ?? 0))}%` }} />
                </div>
                <div className="text-xs text-campo-400 mt-1">{t.pct_ocupado}% de {fmt(t.capacidad_litros)} L</div>
              </>
            ) : (
              <div className="text-xs text-campo-400 mt-3">Sin capacidad máxima definida</div>
            )}
            <div className="flex justify-between text-xs text-campo-500 mt-3 pt-3 border-t border-campo-100">
              <span>Ingresado: {fmt(t.litros_ingresados)} L</span>
              <span>Consumido: {fmt(t.litros_consumidos)} L</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
