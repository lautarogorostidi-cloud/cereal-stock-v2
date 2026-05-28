import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const estadoColor: Record<string, string> = {
  borrador: 'badge-gris',
  activo:   'badge-verde',
  parcial:  'badge-trigo',
  cumplido: 'badge-verde',
  cancelado:'badge-rojo',
}

export default async function ContratosPage() {
  const supabase = createClient()
  const { data: contratos } = await supabase
    .from('vw_posicion_contratos')
    .select('*')
    .order('fecha_contrato', { ascending: false })

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
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Cliente</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Pactado</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Entregado</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Pendiente</th>
                <th className="text-right px-4 py-3 font-semibold text-campo-700">Precio</th>
                <th className="text-center px-4 py-3 font-semibold text-campo-700">%</th>
                <th className="text-left px-4 py-3 font-semibold text-campo-700">Estado</th>
              </tr>
            </thead>
            <tbody>
              {contratos?.map((c, i) => (
                <tr key={i} className="border-b border-campo-50 hover:bg-campo-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-campo-600">{c.numero}</td>
                  <td className="px-4 py-3 text-campo-600">{new Date(c.fecha_contrato).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 font-medium text-campo-900">{c.cultivo}</td>
                  <td className="px-4 py-3 text-campo-700">{c.cliente}</td>
                  <td className="px-4 py-3 text-right">{Number(c.toneladas_pactadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-campo-600">{Number(c.toneladas_entregadas).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-tierra-600 font-medium">{Number(c.toneladas_pendientes).toLocaleString('es-AR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-campo-700">
                    {c.precio_unitario ? `${c.moneda} ${Number(c.precio_unitario).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-12 bg-campo-100 rounded-full h-1.5">
                        <div className="h-full bg-campo-500 rounded-full" style={{ width: `${Math.min(c.pct_cumplimiento, 100)}%` }} />
                      </div>
                      <span className="text-xs text-campo-500">{c.pct_cumplimiento}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={estadoColor[c.estado] ?? 'badge-gris'}>{c.estado}</span>
                  </td>
                </tr>
              ))}
              {(!contratos || contratos.length === 0) && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-campo-400">
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
