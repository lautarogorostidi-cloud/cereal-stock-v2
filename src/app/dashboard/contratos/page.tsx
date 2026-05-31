'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const estadoColor: Record<string, string> = {
  borrador: 'badge-gris',
  activo: 'badge-verde',
  parcial: 'badge-trigo',
  cumplido: 'badge-azul',
  cancelado: 'badge-rojo',
}

export default function ContratosPage() {
  const supabase = createClient()
  const router = useRouter()
  const [contratos, setContratos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [cerrando, setCerrando] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('vw_posicion_contratos')
      .select('*')
      .order('fecha_contrato', { ascending: false })
    setContratos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function cerrarContrato(numero: string) {
    setCerrando(numero)
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id')
      .eq('numero', numero)
      .single()
    
    if (contrato) {
      await supabase
        .from('contratos')
        .update({ estado: 'cumplido' })
        .eq('id', contrato.id)
      await load()
    }
    setCerrando(null)
  }

  async function reabrirContrato(numero: string) {
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id')
      .eq('numero', numero)
      .single()
    
    if (contrato) {
      await supabase
        .from('contratos')
        .update({ estado: 'activo' })
        .eq('id', contrato.id)
      await load()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-campo-900">Contratos</h1>
          <p className="text-campo-500 text-sm mt-0.5">Posición por contrato de venta</p>
        </div>
        <Link href="/dashboard/contratos/nuevo" className="btn-primary">
          + Nuevo contrato
        </Link>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-campo-100 bg-campo-50">
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Nº</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Fecha</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cultivo</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Comprador</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Corredor</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Pactado</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Entregado</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Pendiente</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">%</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Comisión</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">Editar</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-campo-400">Cargando...</td></tr>
              )}
              {!loading && contratos.map((c, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{c.numero}</td>
                  <td className="px-4 py-3 text-campo-600">{new Date(c.fecha_contrato).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{c.cultivo}</td>
                  <td className="px-4 py-3 text-campo-700">{c.cliente}</td>
                  <td className="px-4 py-3 text-campo-500 text-xs">{c.corredor ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{Number(c.toneladas_pactadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-campo-600">{Number(c.toneladas_entregadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-tierra-600 font-medium">{Number(c.toneladas_pendientes).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-campo-700">
                    {c.precio_unitario ? `${c.moneda} ${Number(c.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-campo-500 text-xs">
                    {c.comision_corredor ? `${c.comision_corredor}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-16 bg-campo-100 rounded-full h-2">
                        <div className="h-full bg-campo-500 rounded-full transition-all"
                          style={{ width: `${Math.min(c.pct_cumplimiento, 100)}%` }} />
                      </div>
                      <span className="text-xs text-campo-500 w-10">{c.pct_cumplimiento}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={estadoColor[c.estado] ?? 'badge-gris'}>{c.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => router.push(`/dashboard/contratos/editar?numero=${c.numero}`)}
                      className="text-xs text-campo-500 hover:text-campo-700 underline mr-2"
                    >
                      Editar
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.estado === 'cumplido' ? (
                      <button
                        onClick={() => reabrirContrato(c.numero)}
                        className="text-xs text-campo-500 hover:text-campo-700 underline"
                      >
                        Reabrir
                      </button>
                    ) : c.estado !== 'cancelado' ? (
                      <button
                        onClick={() => cerrarContrato(c.numero)}
                        disabled={cerrando === c.numero}
                        className="text-xs bg-campo-600 hover:bg-campo-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {cerrando === c.numero ? '...' : 'Cerrar'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && contratos.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-campo-400">
                    No hay contratos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}