'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { StockActual } from '@/types'

interface StockResumenProps { data: StockActual[] }

export default function StockResumen({ data }: StockResumenProps) {
  if (!data.length) {
    return <p className="text-sm text-campo-400 py-8 text-center">Sin datos disponibles</p>
  }

  const chartData = data.map(r => ({
    cultivo: r.cultivo_codigo,
    'Físico': Number(r.stock_fisico),
    'Disponible': Number(r.stock_disponible),
    'Vendido': Number(r.ton_vendidas),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d0dab2" />
        <XAxis dataKey="cultivo" tick={{ fontSize: 12, fill: '#587029' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8fa854' }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #d0dab2', fontSize: 12 }}
          formatter={(v: number) => [`${v.toLocaleString('es-AR')} tn`]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Físico"     fill="#8fa854" radius={[4,4,0,0]} />
        <Bar dataKey="Disponible" fill="#d8832a" radius={[4,4,0,0]} />
        <Bar dataKey="Vendido"    fill="#445722" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
